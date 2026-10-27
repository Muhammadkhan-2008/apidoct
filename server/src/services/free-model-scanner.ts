import { getDb } from '../db/index.js';
import { ensureAllModelsInProfiles } from './profile-models.js';
import { decrypt } from '../lib/crypto.js';

export interface DiscoveredModel {
  platform: string;
  modelId: string;
  displayName: string;
  intelligenceRank: number;
  speedRank: number;
  sizeLabel: string;
  contextWindow: number;
  supportsVision: boolean;
  supportsTools: boolean;
  monthlyTokenBudget: string;
  monthlyTokenBudgetTokens: number;
  isFreePromo: boolean;
}

/**
 * Live queries OpenRouter API to fetch newly added zero-cost/free models in real-time.
 */
async function fetchLiveOpenRouterFreeModels(): Promise<DiscoveredModel[]> {
  try {
    const db = getDb();
    let apiKey = '';
    try {
      const keyRow = db
        .prepare(
          "SELECT encrypted_key, iv, auth_tag FROM api_keys WHERE platform = 'openrouter' AND enabled = 1 LIMIT 1"
        )
        .get() as any;
      if (keyRow) {
        apiKey = decrypt(keyRow.encrypted_key, keyRow.iv, keyRow.auth_tag);
      }
    } catch {}

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const res = await fetch('https://openrouter.ai/api/v1/models', { signal: controller.signal, headers });
    clearTimeout(timer);

    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<any> };
    if (!Array.isArray(data.data)) return [];

    const discovered: DiscoveredModel[] = [];
    for (const m of data.data) {
      const isFree =
        typeof m.id === 'string' &&
        (m.id.endsWith(':free') ||
          (m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0'));

      if (!isFree) continue;

      const isLarge = m.id.includes('70b') || m.id.includes('r1') || m.id.includes('large');
      const isVision = m.architecture?.input_modalities?.includes('image') || m.id.includes('vl');
      const isTools = m.supported_parameters?.includes('tools') ?? true;

      discovered.push({
        platform: 'openrouter',
        modelId: m.id,
        displayName: `${m.name || m.id} (Free)`,
        intelligenceRank: isLarge ? 98 : 88,
        speedRank: 94,
        sizeLabel: isLarge ? '70B+' : 'Free',
        contextWindow: typeof m.context_length === 'number' && m.context_length > 0 ? m.context_length : 65536,
        supportsVision: Boolean(isVision),
        supportsTools: Boolean(isTools),
        monthlyTokenBudget: '50.0M',
        monthlyTokenBudgetTokens: 50_000_000,
        isFreePromo: true,
      });
    }

    return discovered;
  } catch (err) {
    console.warn('[FreeModelScanner] Live OpenRouter models query skipped:', err);
    return [];
  }
}

/**
 * Scans live endpoints, prunes dead models, and populates verified live free models into SQLite DB.
 */
export async function scanAndAutoFetchFreeModels(): Promise<{
  scanned: number;
  inserted: number;
  updated: number;
  activeCount: number;
}> {
  const db = getDb();
  let inserted = 0;
  let updated = 0;

  // 1. Fetch live models from OpenRouter API with user's key
  const liveOpenRouter = await fetchLiveOpenRouterFreeModels();
  const liveFreeIds = new Set(liveOpenRouter.map((m) => m.modelId));

  // 2. Identify platforms with active enabled API keys
  const activeKeys = db
    .prepare("SELECT DISTINCT platform FROM api_keys WHERE enabled = 1 AND status != 'invalid'")
    .all() as Array<{ platform: string }>;
  const configuredPlatforms = new Set(activeKeys.map((k) => k.platform.toLowerCase()));

  db.transaction(() => {
    // 3. Disable all models from platforms where user has NO API keys
    const allPlatforms = db.prepare('SELECT DISTINCT platform FROM models').all() as Array<{ platform: string }>;
    for (const p of allPlatforms) {
      if (!configuredPlatforms.has(p.platform.toLowerCase())) {
        db.prepare('UPDATE models SET enabled = 0 WHERE LOWER(platform) = ?').run(p.platform.toLowerCase());
        db.prepare(
          'UPDATE fallback_config SET enabled = 0 WHERE model_db_id IN (SELECT id FROM models WHERE LOWER(platform) = ?)'
        ).run(p.platform.toLowerCase());
      }
    }

    // 4. Disable dead OpenRouter models not in live free list
    const openRouterCatalog = db
      .prepare("SELECT id, model_id FROM models WHERE platform = 'openrouter'")
      .all() as Array<{ id: number; model_id: string }>;
    for (const m of openRouterCatalog) {
      if (!liveFreeIds.has(m.model_id)) {
        db.prepare('UPDATE models SET enabled = 0 WHERE id = ?').run(m.id);
        db.prepare('UPDATE fallback_config SET enabled = 0 WHERE model_db_id = ?').run(m.id);
        db.prepare(
          "INSERT OR REPLACE INTO catalog_model_tombstones (kind, platform, model_id, source, reason) VALUES ('chat', 'openrouter', ?, 'upstream_eol', 'OpenRouter 404: Unavailable for free')"
        ).run(m.model_id);
      } else {
        db.prepare(
          "DELETE FROM catalog_model_tombstones WHERE kind = 'chat' AND platform = 'openrouter' AND model_id = ?"
        ).run(m.model_id);
      }
    }

    // 5. Disable Google models due to project 403 (billing required)
    const googleModels = db
      .prepare("SELECT id, model_id FROM models WHERE platform = 'google'")
      .all() as Array<{ id: number; model_id: string }>;
    for (const gm of googleModels) {
      db.prepare('UPDATE models SET enabled = 0 WHERE id = ?').run(gm.id);
      db.prepare('UPDATE fallback_config SET enabled = 0 WHERE model_db_id = ?').run(gm.id);
      db.prepare(
        "INSERT OR REPLACE INTO catalog_model_tombstones (kind, platform, model_id, source, reason) VALUES ('chat', 'google', ?, 'upstream_eol', 'Google 403: Free tier unavailable for this project (billing required)')"
      ).run(gm.model_id);
    }

    // 6. Insert / Update the live free OpenRouter models
    const selectStmt = db.prepare(
      'SELECT id FROM models WHERE platform = ? AND model_id = ? AND endpoint_scope = ?'
    );
    const insertStmt = db.prepare(`
      INSERT INTO models (platform, model_id, display_name, intelligence_rank, speed_rank, size_label,
                          rpm_limit, rpd_limit, tpm_limit, tpd_limit, monthly_token_budget, context_window,
                          enabled, supports_vision, supports_tools, source, endpoint_scope)
      VALUES (?, ?, ?, ?, ?, ?, 20, 200, NULL, NULL, ?, ?, 1, ?, ?, 'catalog', '')
    `);
    const updateStmt = db.prepare(`
      UPDATE models SET
        display_name = ?, intelligence_rank = ?, speed_rank = ?, size_label = ?,
        monthly_token_budget = ?, context_window = ?, supports_vision = ?, supports_tools = ?, enabled = 1
      WHERE id = ?
    `);

    for (const m of liveOpenRouter) {
      const existing = selectStmt.get('openrouter', m.modelId, '') as { id: number } | undefined;
      let modelIdNum: number;
      if (existing) {
        updateStmt.run(
          m.displayName,
          m.intelligenceRank,
          m.speedRank,
          m.sizeLabel,
          m.monthlyTokenBudget,
          m.contextWindow,
          m.supportsVision ? 1 : 0,
          m.supportsTools ? 1 : 0,
          existing.id
        );
        modelIdNum = existing.id;
        updated++;
      } else {
        const info = insertStmt.run(
          'openrouter',
          m.modelId,
          m.displayName,
          m.intelligenceRank,
          m.speedRank,
          m.sizeLabel,
          m.monthlyTokenBudget,
          m.contextWindow,
          m.supportsVision ? 1 : 0,
          m.supportsTools ? 1 : 0
        );
        modelIdNum = Number(info.lastInsertRowid);
        inserted++;
      }
      db.prepare(
        'INSERT OR IGNORE INTO fallback_config (model_db_id, priority, enabled) VALUES (?, (SELECT COALESCE(MAX(priority), 0) + 1 FROM fallback_config), 1)'
      ).run(modelIdNum);
      db.prepare('UPDATE fallback_config SET enabled = 1 WHERE model_db_id = ?').run(modelIdNum);
    }

    // 7. Ensure working Mistral & Cohere models are enabled
    db.prepare(
      "UPDATE models SET enabled = 1 WHERE platform = 'mistral' AND model_id IN ('codestral-latest', 'ministral-3b-latest', 'ministral-14b-latest')"
    ).run();
    db.prepare(
      "UPDATE fallback_config SET enabled = 1 WHERE model_db_id IN (SELECT id FROM models WHERE platform = 'mistral' AND model_id IN ('codestral-latest', 'ministral-3b-latest', 'ministral-14b-latest'))"
    ).run();

    db.prepare(
      "UPDATE models SET enabled = 1 WHERE platform = 'cohere' AND model_id IN ('command-r-08-2024', 'c4ai-aya-expanse-32b')"
    ).run();
    db.prepare(
      "UPDATE fallback_config SET enabled = 1 WHERE model_db_id IN (SELECT id FROM models WHERE platform = 'cohere' AND model_id IN ('command-r-08-2024', 'c4ai-aya-expanse-32b'))"
    ).run();

    // 8. Put verified working models at top priority in fallback_config
    const priorityOrdering = [
      { platform: 'mistral', modelId: 'codestral-latest' },
      { platform: 'openrouter', modelId: 'liquid/lfm-2.5-2.6b:free' },
      { platform: 'openrouter', modelId: 'nvidia/nemotron-3.5-lightning:free' },
      { platform: 'openrouter', modelId: 'recursive/flint-v1.0:free' },
      { platform: 'openrouter', modelId: 'dots-studio/dots-3-note-preview:free' },
      { platform: 'openrouter', modelId: 'thinkingmachines/inkling:free' },
      { platform: 'cohere', modelId: 'command-r-08-2024' },
      { platform: 'openrouter', modelId: 'openrouter/free' },
      { platform: 'openrouter', modelId: 'cohere/north-mini-code:free' },
      { platform: 'openrouter', modelId: 'google/gemma-4-26b-a4b-it:free' },
      { platform: 'openrouter', modelId: 'poolside/laguna-s-2.1:free' },
    ];

    let rank = 1;
    for (const po of priorityOrdering) {
      const row = db
        .prepare('SELECT id FROM models WHERE platform = ? AND model_id = ?')
        .get(po.platform, po.modelId) as { id: number } | undefined;
      if (row) {
        db.prepare('UPDATE fallback_config SET priority = ?, enabled = 1 WHERE model_db_id = ?').run(rank++, row.id);
      }
    }

    try {
      ensureAllModelsInProfiles(db);
    } catch {}
  })();

  const activeCount = (
    db
      .prepare(
        'SELECT COUNT(*) as count FROM fallback_config fc JOIN models m ON m.id = fc.model_db_id WHERE fc.enabled = 1 AND m.enabled = 1'
      )
      .get() as any
  ).count;
  console.log(
    `[FreeModelScanner] Live free models sync: ${liveOpenRouter.length} live OpenRouter free models, active routing pool: ${activeCount}`
  );
  return { scanned: liveOpenRouter.length, inserted, updated, activeCount };
}

/**
 * Background periodic auto-scanner worker (runs 3s after boot & every 20 minutes).
 */
export function startFreeModelAutoScanner() {
  setTimeout(() => {
    scanAndAutoFetchFreeModels().catch((err) => console.error('[FreeModelScanner] Boot scan error:', err));
  }, 3000);

  setInterval(() => {
    scanAndAutoFetchFreeModels().catch((err) => console.error('[FreeModelScanner] Periodic scan error:', err));
  }, 1200_000);
}
