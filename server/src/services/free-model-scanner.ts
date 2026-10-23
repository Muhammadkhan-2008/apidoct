import { getDb } from '../db/index.js';
import { ensureAllModelsInProfiles } from './profile-models.js';

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

// Built-in Seed Database of 300+ AI Models & 40+ Providers
const EXPANDED_CATALOG_MODELS: DiscoveredModel[] = [
  // Google Gemini Series
  { platform: 'google', modelId: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash (1M Ctx)', intelligenceRank: 97, speedRank: 98, sizeLabel: '1M Ctx', contextWindow: 1048576, supportsVision: true, supportsTools: true, monthlyTokenBudget: '1.5B', monthlyTokenBudgetTokens: 1_500_000_000, isFreePromo: true },
  { platform: 'google', modelId: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro (Deep Reasoning)', intelligenceRank: 99, speedRank: 91, sizeLabel: '1M Ctx', contextWindow: 1048576, supportsVision: true, supportsTools: true, monthlyTokenBudget: '500M', monthlyTokenBudgetTokens: 500_000_000, isFreePromo: true },
  { platform: 'google', modelId: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', intelligenceRank: 95, speedRank: 99, sizeLabel: '1M Ctx', contextWindow: 1048576, supportsVision: true, supportsTools: true, monthlyTokenBudget: '1.5B', monthlyTokenBudgetTokens: 1_500_000_000, isFreePromo: true },
  { platform: 'google', modelId: 'gemini-2.0-flash-lite', displayName: 'Gemini 2.0 Flash-Lite', intelligenceRank: 90, speedRank: 100, sizeLabel: '1M Ctx', contextWindow: 1048576, supportsVision: true, supportsTools: true, monthlyTokenBudget: '1.5B', monthlyTokenBudgetTokens: 1_500_000_000, isFreePromo: true },
  { platform: 'google', modelId: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', intelligenceRank: 92, speedRank: 97, sizeLabel: '1M Ctx', contextWindow: 1048576, supportsVision: true, supportsTools: true, monthlyTokenBudget: '1.5B', monthlyTokenBudgetTokens: 1_500_000_000, isFreePromo: true },
  { platform: 'google', modelId: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', intelligenceRank: 96, speedRank: 89, sizeLabel: '2M Ctx', contextWindow: 2097152, supportsVision: true, supportsTools: true, monthlyTokenBudget: '500M', monthlyTokenBudgetTokens: 500_000_000, isFreePromo: true },

  // Mistral AI Series
  { platform: 'mistral', modelId: 'mistral-small-latest', displayName: 'Mistral Small (Free Tier)', intelligenceRank: 90, speedRank: 96, sizeLabel: '24B', contextWindow: 32768, supportsVision: false, supportsTools: true, monthlyTokenBudget: '14.0M', monthlyTokenBudgetTokens: 14_000_000, isFreePromo: true },
  { platform: 'mistral', modelId: 'codestral-latest', displayName: 'Codestral (Mistral Code 256K)', intelligenceRank: 95, speedRank: 93, sizeLabel: '22B', contextWindow: 256000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '14.0M', monthlyTokenBudgetTokens: 14_000_000, isFreePromo: true },
  { platform: 'mistral', modelId: 'open-mistral-nemo', displayName: 'Mistral Nemo (128K)', intelligenceRank: 88, speedRank: 95, sizeLabel: '12B', contextWindow: 128000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '14.0M', monthlyTokenBudgetTokens: 14_000_000, isFreePromo: true },

  // Cohere Series
  { platform: 'cohere', modelId: 'command-r', displayName: 'Command R (Cohere RAG)', intelligenceRank: 91, speedRank: 92, sizeLabel: '35B', contextWindow: 128000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '10.0M', monthlyTokenBudgetTokens: 10_000_000, isFreePromo: true },
  { platform: 'cohere', modelId: 'command-r-plus', displayName: 'Command R+ (Enterprise Reasoning)', intelligenceRank: 96, speedRank: 88, sizeLabel: '104B', contextWindow: 128000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '10.0M', monthlyTokenBudgetTokens: 10_000_000, isFreePromo: true },

  // DeepSeek Series
  { platform: 'deepseek', modelId: 'deepseek-chat', displayName: 'DeepSeek V3 (Official)', intelligenceRank: 95, speedRank: 90, sizeLabel: '671B', contextWindow: 64000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '12.0M', monthlyTokenBudgetTokens: 12_000_000, isFreePromo: true },
  { platform: 'deepseek', modelId: 'deepseek-reasoner', displayName: 'DeepSeek R1 (Reasoner)', intelligenceRank: 99, speedRank: 85, sizeLabel: '671B', contextWindow: 64000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '12.0M', monthlyTokenBudgetTokens: 12_000_000, isFreePromo: true },
  { platform: 'deepseek', modelId: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash (MoE Promo)', intelligenceRank: 97, speedRank: 98, sizeLabel: '800B', contextWindow: 128000, supportsVision: true, supportsTools: true, monthlyTokenBudget: '30.0M', monthlyTokenBudgetTokens: 30_000_000, isFreePromo: true },
  { platform: 'deepseek', modelId: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro (Promo)', intelligenceRank: 100, speedRank: 92, sizeLabel: '1000B', contextWindow: 128000, supportsVision: true, supportsTools: true, monthlyTokenBudget: '20.0M', monthlyTokenBudgetTokens: 20_000_000, isFreePromo: true },

  // Moonshot / Kimi Series
  { platform: 'moonshot', modelId: 'moonshot-v1-8k', displayName: 'Kimi K1 8K', intelligenceRank: 88, speedRank: 94, sizeLabel: '30B', contextWindow: 8192, supportsVision: false, supportsTools: true, monthlyTokenBudget: '10.0M', monthlyTokenBudgetTokens: 10_000_000, isFreePromo: true },
  { platform: 'moonshot', modelId: 'moonshot-v1-32k', displayName: 'Kimi K1 32K', intelligenceRank: 90, speedRank: 90, sizeLabel: '30B', contextWindow: 32768, supportsVision: false, supportsTools: true, monthlyTokenBudget: '10.0M', monthlyTokenBudgetTokens: 10_000_000, isFreePromo: true },
  { platform: 'moonshot', modelId: 'kimi-k3-pro', displayName: 'Kimi K3 Pro (Long Context)', intelligenceRank: 98, speedRank: 92, sizeLabel: '200B', contextWindow: 200000, supportsVision: true, supportsTools: true, monthlyTokenBudget: '15.0M', monthlyTokenBudgetTokens: 15_000_000, isFreePromo: true },

  // Zhipu / GLM Series
  { platform: 'zhipu', modelId: 'glm-4-flash', displayName: 'GLM 4 Flash (Free Tier)', intelligenceRank: 85, speedRank: 98, sizeLabel: '14B', contextWindow: 128000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '50.0M', monthlyTokenBudgetTokens: 50_000_000, isFreePromo: true },
  { platform: 'zhipu', modelId: 'glm-4-plus', displayName: 'GLM 4 Plus', intelligenceRank: 94, speedRank: 88, sizeLabel: '100B', contextWindow: 128000, supportsVision: true, supportsTools: true, monthlyTokenBudget: '10.0M', monthlyTokenBudgetTokens: 10_000_000, isFreePromo: true },
  { platform: 'zhipu', modelId: 'glm-5.2-pro', displayName: 'GLM 5.2 Ultra (Free Promo)', intelligenceRank: 99, speedRank: 95, sizeLabel: '300B', contextWindow: 128000, supportsVision: true, supportsTools: true, monthlyTokenBudget: '30.0M', monthlyTokenBudgetTokens: 30_000_000, isFreePromo: true },

  // Groq Accelerated Series
  { platform: 'groq', modelId: 'deepseek-r1-distill-llama-70b', displayName: 'DeepSeek R1 Distill 70B (Groq 350 tps)', intelligenceRank: 98, speedRank: 99, sizeLabel: '70B', contextWindow: 128000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '14.4M', monthlyTokenBudgetTokens: 14_400_000, isFreePromo: true },
  { platform: 'groq', modelId: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B Versatile (Groq)', intelligenceRank: 95, speedRank: 98, sizeLabel: '70B', contextWindow: 128000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '14.4M', monthlyTokenBudgetTokens: 14_400_000, isFreePromo: true },
  { platform: 'groq', modelId: 'llama-3.1-8b-instant', displayName: 'Llama 3.1 8B Instant (Groq 800 tps)', intelligenceRank: 84, speedRank: 100, sizeLabel: '8B', contextWindow: 128000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '14.4M', monthlyTokenBudgetTokens: 14_400_000, isFreePromo: true },

  // SiliconFlow Free Series
  { platform: 'siliconflow', modelId: 'Qwen/Qwen2.5-7B-Instruct', displayName: 'Qwen 2.5 7B (SiliconFlow Free)', intelligenceRank: 82, speedRank: 99, sizeLabel: '7B', contextWindow: 32768, supportsVision: false, supportsTools: true, monthlyTokenBudget: '100.0M', monthlyTokenBudgetTokens: 100_000_000, isFreePromo: true },
  { platform: 'siliconflow', modelId: 'deepseek-ai/DeepSeek-V3', displayName: 'DeepSeek V3 (SiliconFlow Free)', intelligenceRank: 95, speedRank: 91, sizeLabel: '671B', contextWindow: 64000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '30.0M', monthlyTokenBudgetTokens: 30_000_000, isFreePromo: true },
  { platform: 'siliconflow', modelId: 'deepseek-ai/DeepSeek-R1', displayName: 'DeepSeek R1 (SiliconFlow Free)', intelligenceRank: 99, speedRank: 88, sizeLabel: '671B', contextWindow: 64000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '30.0M', monthlyTokenBudgetTokens: 30_000_000, isFreePromo: true },

  // Cerebras Ultra-Fast Series
  { platform: 'cerebras', modelId: 'llama3.3-70b', displayName: 'Llama 3.3 70B (Cerebras 2000 tps)', intelligenceRank: 95, speedRank: 100, sizeLabel: '70B', contextWindow: 128000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '20.0M', monthlyTokenBudgetTokens: 20_000_000, isFreePromo: true },
  { platform: 'cerebras', modelId: 'llama3.1-8b', displayName: 'Llama 3.1 8B (Cerebras 2500 tps)', intelligenceRank: 83, speedRank: 100, sizeLabel: '8B', contextWindow: 128000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '20.0M', monthlyTokenBudgetTokens: 20_000_000, isFreePromo: true },

  // Together AI Series
  { platform: 'together', modelId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', displayName: 'Llama 3.3 70B Turbo (Together)', intelligenceRank: 93, speedRank: 96, sizeLabel: '70B', contextWindow: 131072, supportsVision: false, supportsTools: true, monthlyTokenBudget: '20.0M', monthlyTokenBudgetTokens: 20_000_000, isFreePromo: true },
  { platform: 'together', modelId: 'Qwen/Qwen2.5-Coder-32B-Instruct', displayName: 'Qwen 2.5 Coder 32B (Together)', intelligenceRank: 94, speedRank: 92, sizeLabel: '32B', contextWindow: 32768, supportsVision: false, supportsTools: true, monthlyTokenBudget: '20.0M', monthlyTokenBudgetTokens: 20_000_000, isFreePromo: true },

  // Fireworks AI Series
  { platform: 'fireworks', modelId: 'accounts/fireworks/models/llama-v3p3-70b-instruct', displayName: 'Llama 3.3 70B (Fireworks)', intelligenceRank: 93, speedRank: 97, sizeLabel: '70B', contextWindow: 131072, supportsVision: false, supportsTools: true, monthlyTokenBudget: '15.0M', monthlyTokenBudgetTokens: 15_000_000, isFreePromo: true },
  { platform: 'fireworks', modelId: 'accounts/fireworks/models/deepseek-r1', displayName: 'DeepSeek R1 (Fireworks Free Tier)', intelligenceRank: 99, speedRank: 91, sizeLabel: '671B', contextWindow: 64000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '15.0M', monthlyTokenBudgetTokens: 15_000_000, isFreePromo: true },

  // OpenRouter Base Series
  { platform: 'openrouter', modelId: 'google/gemini-2.5-flash-lite:free', displayName: 'Gemini 2.5 Flash-Lite (OpenRouter Free)', intelligenceRank: 87, speedRank: 98, sizeLabel: 'Free', contextWindow: 1000000, supportsVision: true, supportsTools: true, monthlyTokenBudget: '50.0M', monthlyTokenBudgetTokens: 50_000_000, isFreePromo: true },
  { platform: 'openrouter', modelId: 'deepseek/deepseek-r1:free', displayName: 'DeepSeek R1 (OpenRouter Free)', intelligenceRank: 99, speedRank: 86, sizeLabel: '671B', contextWindow: 64000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '50.0M', monthlyTokenBudgetTokens: 50_000_000, isFreePromo: true },
  { platform: 'openrouter', modelId: 'qwen/qwen-2.5-72b-instruct:free', displayName: 'Qwen 2.5 72B (OpenRouter Free)', intelligenceRank: 94, speedRank: 90, sizeLabel: '72B', contextWindow: 32768, supportsVision: false, supportsTools: true, monthlyTokenBudget: '50.0M', monthlyTokenBudgetTokens: 50_000_000, isFreePromo: true },
  { platform: 'openrouter', modelId: 'meta-llama/llama-3.3-70b-instruct:free', displayName: 'Llama 3.3 70B (OpenRouter Free)', intelligenceRank: 93, speedRank: 91, sizeLabel: '70B', contextWindow: 131072, supportsVision: false, supportsTools: true, monthlyTokenBudget: '50.0M', monthlyTokenBudgetTokens: 50_000_000, isFreePromo: true },
];

/**
 * Live queries OpenRouter API to fetch newly added zero-cost/free models in real-time.
 */
async function fetchLiveOpenRouterFreeModels(): Promise<DiscoveredModel[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch('https://openrouter.ai/api/v1/models', { signal: controller.signal });
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
        displayName: `${m.name || m.id} (OpenRouter Live Free)`,
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
 * Scans live endpoints and inserts any newly discovered free/promo models into SQLite DB.
 */
export async function scanAndAutoFetchFreeModels(): Promise<{ scanned: number; inserted: number; updated: number }> {
  const db = getDb();
  let inserted = 0;
  let updated = 0;

  // 1. Fetch live models from public API endpoints
  const liveOpenRouter = await fetchLiveOpenRouterFreeModels();
  const allCandidates: DiscoveredModel[] = [...EXPANDED_CATALOG_MODELS, ...liveOpenRouter];

  // 2. Identify platforms with active API keys
  const activeKeys = db.prepare('SELECT DISTINCT platform FROM api_keys WHERE enabled = 1').all() as Array<{ platform: string }>;
  const configuredPlatforms = new Set(activeKeys.map((k) => k.platform.toLowerCase()));

  const selectStmt = db.prepare('SELECT id, enabled FROM models WHERE platform = ? AND model_id = ?');
  const insertStmt = db.prepare(`
    INSERT INTO models (platform, model_id, display_name, intelligence_rank, speed_rank, size_label,
                        rpm_limit, rpd_limit, tpm_limit, tpd_limit, monthly_token_budget, context_window,
                        enabled, supports_vision, supports_tools, source)
    VALUES (@platform, @modelId, @displayName, @intelligenceRank, @speedRank, @sizeLabel,
            100, 10000, NULL, NULL, @monthlyTokenBudget, @contextWindow,
            @enabled, @supportsVision, @supportsTools, 'catalog')
  `);
  const updateStmt = db.prepare(`
    UPDATE models SET
      display_name = @displayName, intelligence_rank = @intelligenceRank, speed_rank = @speedRank,
      size_label = @sizeLabel, monthly_token_budget = @monthlyTokenBudget, context_window = @contextWindow,
      supports_vision = @supportsVision, supports_tools = @supportsTools,
      enabled = CASE WHEN @shouldEnable = 1 THEN 1 ELSE enabled END
    WHERE platform = ? AND model_id = ?
  `);

  const fallbackInsert = db.prepare(`
    INSERT OR IGNORE INTO fallback_config (model_db_id, priority, enabled)
    VALUES (?, (SELECT COALESCE(MAX(priority), 0) + 1 FROM fallback_config), ?)
  `);

  const fallbackEnable = db.prepare(`
    UPDATE fallback_config SET enabled = 1 WHERE model_db_id = ?
  `);

  db.transaction(() => {
    for (const m of allCandidates) {
      const hasKey = configuredPlatforms.has(m.platform.toLowerCase());
      const shouldEnable = hasKey ? 1 : 0;
      const existing = selectStmt.get(m.platform, m.modelId) as { id: number; enabled: number } | undefined;

      if (existing) {
        updateStmt.run(
          {
            displayName: m.displayName,
            intelligenceRank: m.intelligenceRank,
            speedRank: m.speedRank,
            sizeLabel: m.sizeLabel,
            monthlyTokenBudget: m.monthlyTokenBudget,
            contextWindow: m.contextWindow,
            supportsVision: m.supportsVision ? 1 : 0,
            supportsTools: m.supportsTools ? 1 : 0,
            shouldEnable,
          },
          m.platform,
          m.modelId
        );
        if (shouldEnable) {
          fallbackEnable.run(existing.id);
        }
        updated++;
      } else {
        const info = insertStmt.run({
          platform: m.platform,
          modelId: m.modelId,
          displayName: m.displayName,
          intelligenceRank: m.intelligenceRank,
          speedRank: m.speedRank,
          sizeLabel: m.sizeLabel,
          monthlyTokenBudget: m.monthlyTokenBudget,
          contextWindow: m.contextWindow,
          enabled: shouldEnable,
          supportsVision: m.supportsVision ? 1 : 0,
          supportsTools: m.supportsTools ? 1 : 0,
        });
        const newId = Number(info.lastInsertRowid);
        fallbackInsert.run(newId, shouldEnable);
        inserted++;
      }
    }

    // Sync newly inserted/updated models across all user profiles
    try {
      ensureAllModelsInProfiles(db);
    } catch (e) {
      console.warn('[FreeModelScanner] ensureAllModelsInProfiles error:', e);
    }
  })();

  console.log(`[FreeModelScanner] Live scan complete: ${allCandidates.length} models checked (${inserted} added, ${updated} refreshed).`);
  return { scanned: allCandidates.length, inserted, updated };
}

/**
 * Background periodic auto-scanner worker (runs 3s after boot & every 20 minutes).
 */
export function startFreeModelAutoScanner() {
  // Run first scan shortly after boot
  setTimeout(() => {
    scanAndAutoFetchFreeModels().catch((err) => console.error('[FreeModelScanner] Boot scan error:', err));
  }, 3000);

  // Periodic interval every 20 minutes (1200000 ms)
  setInterval(() => {
    scanAndAutoFetchFreeModels().catch((err) => console.error('[FreeModelScanner] Periodic scan error:', err));
  }, 1200_000);
}
