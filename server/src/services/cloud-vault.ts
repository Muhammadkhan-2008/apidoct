import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDb } from '../db/index.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { resolveProvider } from '../providers/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_FILE = path.resolve(__dirname, '../../data/cloud_vault.json');

export interface StoredVaultItem {
  platform: string;
  key: string;
  label: string;
  baseUrl?: string;
}

export interface VaultFileStructure {
  version: number;
  vaults: Record<string, {
    updatedAt: string;
    email: string;
    payload: string; // Base64 AES-256-GCM encrypted payload
    iv: string;
    tag: string;
    keyCount: number;
  }>;
}

function deriveKey(email: string): Buffer {
  return crypto.scryptSync(email.toLowerCase().trim(), 'apidoct-cloud-salt-2026', 32);
}

function loadVaultStore(): VaultFileStructure {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const raw = fs.readFileSync(VAULT_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[CloudVault] Failed to load store, initializing empty:', e);
  }
  return { version: 1, vaults: {} };
}

function saveVaultStore(store: VaultFileStructure): void {
  try {
    const dir = path.dirname(VAULT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(VAULT_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('[CloudVault] Failed to save vault store:', e);
  }
}

/**
 * Backup all active keys for a given user email into the Cloud Vault.
 */
export function backupVaultForUser(email: string): { keyCount: number; updatedAt: string } {
  const db = getDb();
  const rows = db.prepare('SELECT platform, label, encrypted_key, iv, auth_tag FROM api_keys WHERE enabled = 1').all() as any[];
  
  const decryptedKeys: StoredVaultItem[] = [];
  for (const r of rows) {
    try {
      const plaintext = decrypt(r.encrypted_key, r.iv, r.auth_tag);
      if (plaintext) {
        decryptedKeys.push({
          platform: r.platform,
          key: plaintext,
          label: r.label || r.platform,
        });
      }
    } catch {}
  }

  const derived = deriveKey(email);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derived, iv);
  const jsonStr = JSON.stringify(decryptedKeys);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const store = loadVaultStore();
  const key = email.toLowerCase().trim();
  const updatedAt = new Date().toISOString();

  store.vaults[key] = {
    updatedAt,
    email: key,
    payload: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    keyCount: decryptedKeys.length,
  };

  saveVaultStore(store);
  console.log(`[CloudVault] Backed up ${decryptedKeys.length} keys for user ${key}`);
  return { keyCount: decryptedKeys.length, updatedAt };
}

/**
 * Restore keys from the Cloud Vault for a given email.
 */
export function restoreVaultForUser(email: string): { restored: number; skippedDuplicates: number; total: number } {
  const store = loadVaultStore();
  const key = email.toLowerCase().trim();
  const entry = store.vaults[key];
  if (!entry) {
    return { restored: 0, skippedDuplicates: 0, total: 0 };
  }

  try {
    const derived = deriveKey(email);
    const iv = Buffer.from(entry.iv, 'base64');
    const tag = Buffer.from(entry.tag, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', derived, iv);
    decipher.setAuthTag(tag);
    const decryptedBuf = Buffer.concat([
      decipher.update(Buffer.from(entry.payload, 'base64')),
      decipher.final(),
    ]);

    const items = JSON.parse(decryptedBuf.toString('utf8')) as StoredVaultItem[];
    const db = getDb();
    const existingRows = db.prepare('SELECT encrypted_key, iv, auth_tag FROM api_keys').all() as any[];
    const existingKeys = new Set<string>();
    for (const row of existingRows) {
      try {
        existingKeys.add(decrypt(row.encrypted_key, row.iv, row.auth_tag));
      } catch {}
    }

    let restored = 0;
    let skipped = 0;

    for (const item of items) {
      if (existingKeys.has(item.key.trim())) {
        skipped++;
        continue;
      }

      if (item.platform !== 'custom' && !resolveProvider(item.platform as any)) {
        continue;
      }

      const { encrypted, iv: itemIv, authTag } = encrypt(item.key.trim());
      db.prepare(`
        INSERT INTO api_keys (platform, label, encrypted_key, iv, auth_tag, status, enabled)
        VALUES (?, ?, ?, ?, ?, 'unknown', 1)
      `).run(item.platform, item.label || item.platform, encrypted, itemIv, authTag);
      existingKeys.add(item.key.trim());
      restored++;
    }

    console.log(`[CloudVault] Restored ${restored} keys for user ${key} (${skipped} duplicates skipped).`);
    return { restored, skippedDuplicates: skipped, total: items.length };
  } catch (err) {
    console.error(`[CloudVault] Failed to decrypt/restore vault for ${key}:`, err);
    throw new Error('Failed to restore Cloud Vault. Decryption failed.');
  }
}

/**
 * Check if a vault backup exists for an email.
 */
export function hasVaultBackup(email: string): { exists: boolean; keyCount?: number; updatedAt?: string } {
  const store = loadVaultStore();
  const entry = store.vaults[email.toLowerCase().trim()];
  if (!entry) return { exists: false };
  return { exists: true, keyCount: entry.keyCount, updatedAt: entry.updatedAt };
}

/**
 * Export self-contained portable sync token string.
 */
export function generatePortableSyncToken(email: string): string {
  const db = getDb();
  const rows = db.prepare('SELECT platform, label, encrypted_key, iv, auth_tag FROM api_keys WHERE enabled = 1').all() as any[];
  
  const decryptedKeys: StoredVaultItem[] = [];
  for (const r of rows) {
    try {
      const plaintext = decrypt(r.encrypted_key, r.iv, r.auth_tag);
      if (plaintext) {
        decryptedKeys.push({
          platform: r.platform,
          key: plaintext,
          label: r.label || r.platform,
        });
      }
    } catch {}
  }

  const payload = {
    v: 1,
    e: email,
    ts: Date.now(),
    k: decryptedKeys,
  };

  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `apidoct-sync:v1:${raw}`;
}

/**
 * Import keys from a portable sync token.
 */
export function importPortableSyncToken(tokenStr: string): { imported: number; skipped: number } {
  const trimmed = tokenStr.trim();
  const prefix = 'apidoct-sync:v1:';
  if (!trimmed.startsWith(prefix)) {
    throw new Error('Invalid ApiDoct sync token format.');
  }

  const base64Data = trimmed.slice(prefix.length);
  const parsed = JSON.parse(Buffer.from(base64Data, 'base64url').toString('utf8'));
  const items = parsed.k as StoredVaultItem[];
  if (!Array.isArray(items)) {
    throw new Error('Invalid token payload: no keys array found.');
  }

  const db = getDb();
  const existingRows = db.prepare('SELECT encrypted_key, iv, auth_tag FROM api_keys').all() as any[];
  const existingKeys = new Set<string>();
  for (const row of existingRows) {
    try {
      existingKeys.add(decrypt(row.encrypted_key, row.iv, row.auth_tag));
    } catch {}
  }

  let imported = 0;
  let skipped = 0;

  for (const item of items) {
    if (existingKeys.has(item.key.trim())) {
      skipped++;
      continue;
    }
    const { encrypted, iv, authTag } = encrypt(item.key.trim());
    db.prepare(`
      INSERT INTO api_keys (platform, label, encrypted_key, iv, auth_tag, status, enabled)
      VALUES (?, ?, ?, ?, ?, 'unknown', 1)
    `).run(item.platform, item.label || item.platform, encrypted, iv, authTag);
    existingKeys.add(item.key.trim());
    imported++;
  }

  return { imported, skipped };
}
