import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  backupVaultForUser,
  restoreVaultForUser,
  hasVaultBackup,
  generatePortableSyncToken,
  importPortableSyncToken,
} from '../services/cloud-vault.js';
import { getDb } from '../db/index.js';

export const syncRouter = Router();

// GET /api/sync/vault — check if vault exists for current session or requested email
syncRouter.get('/vault', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const email = (req.query.email as string) || user?.email;
    if (!email) {
      res.status(400).json({ error: { message: 'User email is required' } });
      return;
    }

    const status = hasVaultBackup(email);
    res.json({
      success: true,
      email,
      ...status,
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err?.message || 'Failed to check vault status' } });
  }
});

// POST /api/sync/vault/backup — backup active keys
syncRouter.post('/vault/backup', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const email = req.body?.email || user?.email;
    if (!email) {
      res.status(400).json({ error: { message: 'User email is required for vault backup' } });
      return;
    }

    const result = backupVaultForUser(email);
    res.json({
      success: true,
      message: `Backed up ${result.keyCount} keys to Cloud Vault.`,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err?.message || 'Failed to backup vault' } });
  }
});

// POST /api/sync/vault/restore — restore keys from vault
syncRouter.post('/vault/restore', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const email = req.body?.email || user?.email;
    if (!email) {
      res.status(400).json({ error: { message: 'User email is required to restore vault' } });
      return;
    }

    const result = restoreVaultForUser(email);
    res.json({
      success: true,
      message: `Restored ${result.restored} keys from Cloud Vault (${result.skippedDuplicates} duplicates skipped).`,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err?.message || 'Failed to restore vault' } });
  }
});

// POST /api/sync/export-token — generate portable sync token
syncRouter.post('/export-token', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const email = user?.email || 'user@apidoct.local';
    const token = generatePortableSyncToken(email);
    res.json({ success: true, token });
  } catch (err: any) {
    res.status(500).json({ error: { message: err?.message || 'Failed to generate sync token' } });
  }
});

// POST /api/sync/import-token — import keys from token
syncRouter.post('/import-token', (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: { message: 'Sync token is required' } });
      return;
    }

    const result = importPortableSyncToken(token);
    res.json({
      success: true,
      message: `Imported ${result.imported} keys (${result.skipped} duplicates skipped).`,
      ...result,
    });
  } catch (err: any) {
    res.status(400).json({ error: { message: err?.message || 'Failed to import token' } });
  }
});
