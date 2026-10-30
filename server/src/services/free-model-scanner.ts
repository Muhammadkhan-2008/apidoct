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

      const isTiny = m.id.includes('2.6b') || m.id.includes('note') || m.id.includes('flint') || m.id.includes('inkling') || m.id.includes('xs');
      const isLarge = m.id.includes('550b') || m.id.includes('70b') || m.id.includes('31b') || m.id.includes('30b') || m.id.includes('29b') || m.id.includes('26b');
      const isVision = m.architecture?.input_modalities?.includes('image') || m.id.includes('vl');
      const isTools = !isTiny && Boolean(m.supported_parameters?.includes('tools'));

      discovered.push({
        platform: 'openrouter',
        modelId: m.id,
        displayName: `${m.name || m.id} (Free)`,
        intelligenceRank: isLarge ? 98 : (isTiny ? 45 : 85),
        speedRank: isTiny ? 98 : 90,
        sizeLabel: isLarge ? (m.id.includes('550b') ? '550B+' : 'Frontier') : (isTiny ? 'Micro' : 'Large'),
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

    // 5. Ensure verified partner & custom models are enabled, and dead/restricted models disabled
    db.prepare(`
      UPDATE models SET enabled = 1 WHERE (
        (platform = 'hcnsec' AND model_id IN ('auto', 'DeepSeek-V4-Flash', 'Qwen3.8-27B')) OR
        (platform = 'dahl' AND model_id IN ('MiniMaxAI/MiniMax-M2.7', 'deepseek-ai/DeepSeek-V4-Flash-0731')) OR
        (platform = 'xkiro' AND model_id IN ('qwen/qwen3.8-max:free', 'minimax/minimax-m3.1-flash', 'mistralai/mistral-large-2512', 'cohere/command-a-plus')) OR
        (platform = 'groq' AND model_id IN ('openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b')) OR
        (platform = 'google' AND model_id IN ('gemini-2.5-flash', 'gemini-2.5-pro')) OR
        (platform = 'mistral' AND model_id IN ('codestral-latest', 'mistral-large-latest', 'ministral-8b-latest', 'mistral-small-latest')) OR
        (platform = 'cohere' AND model_id IN ('command-r-plus-08-2024', 'command-r-08-2024', 'command-a-03-2025', 'c4ai-aya-expanse-32b'))
      )
    `).run();

    // Disable APInex (check-in required), Orca, and retired Groq/Cohere models
    db.prepare(`
      UPDATE models SET enabled = 0 WHERE
        platform = 'apinex' OR
        (platform = 'groq' AND model_id LIKE 'llama%') OR
        (platform = 'cohere' AND model_id = 'command-r') OR
        model_id IN ('stepaudio-2.5-chat', 'zai-org/GLM-5.3-Flash')
    `).run();

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

    // 8. Put high-intelligence verified models at top priority in fallback_config
    const priorityOrdering = [
      { platform: 'hcnsec', modelId: 'DeepSeek-V4-Flash' },
      { platform: 'groq', modelId: 'openai/gpt-oss-120b' },
      { platform: 'dahl', modelId: 'MiniMaxAI/MiniMax-M2.7' },
      { platform: 'xkiro', modelId: 'qwen/qwen3.8-max:free' },
      { platform: 'google', modelId: 'gemini-2.5-flash' },
      { platform: 'mistral', modelId: 'codestral-latest' },
      { platform: 'cohere', modelId: 'command-r-plus-08-2024' },
      { platform: 'hcnsec', modelId: 'auto' },
      { platform: 'dahl', modelId: 'deepseek-ai/DeepSeek-V4-Flash-0731' },
      { platform: 'xkiro', modelId: 'minimax/minimax-m3.1-flash' },
      { platform: 'groq', modelId: 'qwen/qwen3.8-27b' },
      { platform: 'groq', modelId: 'openai/gpt-oss-20b' },
      { platform: 'hcnsec', modelId: 'Qwen3.8-27B' },
      { platform: 'openrouter', modelId: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
      { platform: 'openrouter', modelId: 'google/gemma-4-31b-it:free' },
      { platform: 'openrouter', modelId: 'google/gemma-4-26b-a4b-it:free' },
      { platform: 'openrouter', modelId: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free' },
      { platform: 'cohere', modelId: 'command-r-08-2024' },
      { platform: 'mistral', modelId: 'mistral-large-latest' },
      { platform: 'mistral', modelId: 'ministral-8b-latest' },
      { platform: 'mistral', modelId: 'mistral-small-latest' },
      { platform: 'openrouter', modelId: 'openrouter/free' },
      { platform: 'openrouter', modelId: 'cohere/north-mini-code:free' },
      { platform: 'openrouter', modelId: 'nvidia/nemotron-3.5-lightning:free' },
      { platform: 'openrouter', modelId: 'liquid/lfm-2.5-2.6b:free' },
      { platform: 'openrouter', modelId: 'recursive/flint-v1.0:free' },
      { platform: 'openrouter', modelId: 'dots-studio/dots-3-note-preview:free' },
      { platform: 'openrouter', modelId: 'thinkingmachines/inkling:free' },
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
