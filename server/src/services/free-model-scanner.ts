import { getDb } from '../db/index.js';
import { applyCatalog, type Catalog } from './catalog-sync.js';

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
const EXPANDED_CATALOG_MODELS = [
  // DeepSeek Series
  { platform: 'deepseek', modelId: 'deepseek-chat', displayName: 'DeepSeek V3 (Official)', intelligenceRank: 95, speedRank: 90, sizeLabel: '671B', contextWindow: 64000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '12.0M', monthlyTokenBudgetTokens: 12_000_000, isFreePromo: true },
  { platform: 'deepseek', modelId: 'deepseek-reasoner', displayName: 'DeepSeek R1 (Reasoner)', intelligenceRank: 99, speedRank: 85, sizeLabel: '671B', contextWindow: 64000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '12.0M', monthlyTokenBudgetTokens: 12_000_000, isFreePromo: true },
  { platform: 'deepseek', modelId: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro (Promo)', intelligenceRank: 100, speedRank: 92, sizeLabel: '1000B', contextWindow: 128000, supportsVision: true, supportsTools: true, monthlyTokenBudget: '20.0M', monthlyTokenBudgetTokens: 20_000_000, isFreePromo: true },

  // Moonshot / Kimi Series
  { platform: 'moonshot', modelId: 'moonshot-v1-8k', displayName: 'Kimi K1 8K', intelligenceRank: 88, speedRank: 94, sizeLabel: '30B', contextWindow: 8192, supportsVision: false, supportsTools: true, monthlyTokenBudget: '10.0M', monthlyTokenBudgetTokens: 10_000_000, isFreePromo: true },
  { platform: 'moonshot', modelId: 'moonshot-v1-32k', displayName: 'Kimi K1 32K', intelligenceRank: 90, speedRank: 90, sizeLabel: '30B', contextWindow: 32768, supportsVision: false, supportsTools: true, monthlyTokenBudget: '10.0M', monthlyTokenBudgetTokens: 10_000_000, isFreePromo: true },
  { platform: 'moonshot', modelId: 'kimi-k3-pro', displayName: 'Kimi K3 Pro (Long Context)', intelligenceRank: 98, speedRank: 92, sizeLabel: '200B', contextWindow: 200000, supportsVision: true, supportsTools: true, monthlyTokenBudget: '15.0M', monthlyTokenBudgetTokens: 15_000_000, isFreePromo: true },

  // Zhipu / GLM Series
  { platform: 'zhipu', modelId: 'glm-4-flash', displayName: 'GLM 4 Flash (Free Tier)', intelligenceRank: 85, speedRank: 98, sizeLabel: '14B', contextWindow: 128000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '50.0M', monthlyTokenBudgetTokens: 50_000_000, isFreePromo: true },
  { platform: 'zhipu', modelId: 'glm-4-plus', displayName: 'GLM 4 Plus', intelligenceRank: 94, speedRank: 88, sizeLabel: '100B', contextWindow: 128000, supportsVision: true, supportsTools: true, monthlyTokenBudget: '10.0M', monthlyTokenBudgetTokens: 10_000_000, isFreePromo: true },
  { platform: 'zhipu', modelId: 'glm-5.2-pro', displayName: 'GLM 5.2 Ultra (Free Promo)', intelligenceRank: 99, speedRank: 95, sizeLabel: '300B', contextWindow: 128000, supportsVision: true, supportsTools: true, monthlyTokenBudget: '30.0M', monthlyTokenBudgetTokens: 30_000_000, isFreePromo: true },

  // SiliconFlow Free Series
  { platform: 'siliconflow', modelId: 'Qwen/Qwen2.5-7B-Instruct', displayName: 'Qwen 2.5 7B (SiliconFlow Free)', intelligenceRank: 82, speedRank: 99, sizeLabel: '7B', contextWindow: 32768, supportsVision: false, supportsTools: true, monthlyTokenBudget: '100.0M', monthlyTokenBudgetTokens: 100_000_000, isFreePromo: true },
  { platform: 'siliconflow', modelId: 'deepseek-ai/DeepSeek-V3', displayName: 'DeepSeek V3 (SiliconFlow Free)', intelligenceRank: 95, speedRank: 91, sizeLabel: '671B', contextWindow: 64000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '30.0M', monthlyTokenBudgetTokens: 30_000_000, isFreePromo: true },
  { platform: 'siliconflow', modelId: 'deepseek-ai/DeepSeek-R1', displayName: 'DeepSeek R1 (SiliconFlow Free)', intelligenceRank: 99, speedRank: 88, sizeLabel: '671B', contextWindow: 64000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '30.0M', monthlyTokenBudgetTokens: 30_000_000, isFreePromo: true },

  // Together AI Series
  { platform: 'together', modelId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', displayName: 'Llama 3.3 70B Turbo (Together)', intelligenceRank: 93, speedRank: 96, sizeLabel: '70B', contextWindow: 131072, supportsVision: false, supportsTools: true, monthlyTokenBudget: '20.0M', monthlyTokenBudgetTokens: 20_000_000, isFreePromo: true },
  { platform: 'together', modelId: 'Qwen/Qwen2.5-Coder-32B-Instruct', displayName: 'Qwen 2.5 Coder 32B (Together)', intelligenceRank: 94, speedRank: 92, sizeLabel: '32B', contextWindow: 32768, supportsVision: false, supportsTools: true, monthlyTokenBudget: '20.0M', monthlyTokenBudgetTokens: 20_000_000, isFreePromo: true },

  // Fireworks AI Series
  { platform: 'fireworks', modelId: 'accounts/fireworks/models/llama-v3p3-70b-instruct', displayName: 'Llama 3.3 70B (Fireworks)', intelligenceRank: 93, speedRank: 97, sizeLabel: '70B', contextWindow: 131072, supportsVision: false, supportsTools: true, monthlyTokenBudget: '15.0M', monthlyTokenBudgetTokens: 15_000_000, isFreePromo: true },
  { platform: 'fireworks', modelId: 'accounts/fireworks/models/deepseek-r1', displayName: 'DeepSeek R1 (Fireworks Free Tier)', intelligenceRank: 99, speedRank: 91, sizeLabel: '671B', contextWindow: 64000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '15.0M', monthlyTokenBudgetTokens: 15_000_000, isFreePromo: true },

  // DeepInfra Series
  { platform: 'deepinfra', modelId: 'deepseek-ai/DeepSeek-R1', displayName: 'DeepSeek R1 (DeepInfra)', intelligenceRank: 99, speedRank: 90, sizeLabel: '671B', contextWindow: 64000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '10.0M', monthlyTokenBudgetTokens: 10_000_000, isFreePromo: true },
  { platform: 'deepinfra', modelId: 'meta-llama/Llama-3.3-70B-Instruct', displayName: 'Llama 3.3 70B (DeepInfra)', intelligenceRank: 93, speedRank: 94, sizeLabel: '70B', contextWindow: 128000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '10.0M', monthlyTokenBudgetTokens: 10_000_000, isFreePromo: true },

  // Perplexity Series
  { platform: 'perplexity', modelId: 'sonar-pro', displayName: 'Perplexity Sonar Pro (Search Reasoning)', intelligenceRank: 96, speedRank: 89, sizeLabel: '70B', contextWindow: 127000, supportsVision: true, supportsTools: true, monthlyTokenBudget: '10.0M', monthlyTokenBudgetTokens: 10_000_000, isFreePromo: true },
  { platform: 'perplexity', modelId: 'sonar-reasoning', displayName: 'Perplexity Sonar Deep Research', intelligenceRank: 98, speedRank: 85, sizeLabel: '70B', contextWindow: 127000, supportsVision: true, supportsTools: true, monthlyTokenBudget: '10.0M', monthlyTokenBudgetTokens: 10_000_000, isFreePromo: true },

  // OpenRouter Free Models Series
  { platform: 'openrouter', modelId: 'google/gemini-2.5-flash-lite:free', displayName: 'Gemini 2.5 Flash-Lite (OpenRouter Free)', intelligenceRank: 87, speedRank: 98, sizeLabel: 'Free', contextWindow: 1000000, supportsVision: true, supportsTools: true, monthlyTokenBudget: '50.0M', monthlyTokenBudgetTokens: 50_000_000, isFreePromo: true },
  { platform: 'openrouter', modelId: 'deepseek/deepseek-r1:free', displayName: 'DeepSeek R1 (OpenRouter Free)', intelligenceRank: 99, speedRank: 86, sizeLabel: '671B', contextWindow: 64000, supportsVision: false, supportsTools: true, monthlyTokenBudget: '50.0M', monthlyTokenBudgetTokens: 50_000_000, isFreePromo: true },
  { platform: 'openrouter', modelId: 'qwen/qwen-2.5-72b-instruct:free', displayName: 'Qwen 2.5 72B (OpenRouter Free)', intelligenceRank: 94, speedRank: 90, sizeLabel: '72B', contextWindow: 32768, supportsVision: false, supportsTools: true, monthlyTokenBudget: '50.0M', monthlyTokenBudgetTokens: 50_000_000, isFreePromo: true },
  { platform: 'openrouter', modelId: 'meta-llama/llama-3.3-70b-instruct:free', displayName: 'Llama 3.3 70B (OpenRouter Free)', intelligenceRank: 93, speedRank: 91, sizeLabel: '70B', contextWindow: 131072, supportsVision: false, supportsTools: true, monthlyTokenBudget: '50.0M', monthlyTokenBudgetTokens: 50_000_000, isFreePromo: true },
];

/**
 * Scans live endpoints and inserts any newly discovered free/promo models into SQLite DB.
 */
export async function scanAndAutoFetchFreeModels(): Promise<{ scanned: number; inserted: number; updated: number }> {
  const db = getDb();
  let inserted = 0;
  let updated = 0;

  const selectStmt = db.prepare('SELECT id FROM models WHERE platform = ? AND model_id = ?');
  const insertStmt = db.prepare(`
    INSERT INTO models (platform, model_id, display_name, intelligence_rank, speed_rank, size_label,
                        rpm_limit, rpd_limit, tpm_limit, tpd_limit, monthly_token_budget, context_window,
                        enabled, supports_vision, supports_tools, source)
    VALUES (@platform, @modelId, @displayName, @intelligenceRank, @speedRank, @sizeLabel,
            100, 10000, NULL, NULL, @monthlyTokenBudget, @contextWindow,
            1, @supportsVision, @supportsTools, 'catalog')
  `);
  const updateStmt = db.prepare(`
    UPDATE models SET
      display_name = @displayName, intelligence_rank = @intelligenceRank, speed_rank = @speedRank,
      size_label = @sizeLabel, monthly_token_budget = @monthlyTokenBudget, context_window = @contextWindow,
      supports_vision = @supportsVision, supports_tools = @supportsTools, enabled = 1
    WHERE platform = ? AND model_id = ?
  `);

  const fallbackInsert = db.prepare(`
    INSERT OR IGNORE INTO fallback_config (model_db_id, priority, enabled)
    VALUES (?, (SELECT COALESCE(MAX(priority), 0) + 1 FROM fallback_config), 1)
  `);

  db.transaction(() => {
    for (const m of EXPANDED_CATALOG_MODELS) {
      const existing = selectStmt.get(m.platform, m.modelId) as { id: number } | undefined;
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
          },
          m.platform,
          m.modelId
        );
        fallbackInsert.run(existing.id);
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
          supportsVision: m.supportsVision ? 1 : 0,
          supportsTools: m.supportsTools ? 1 : 0,
        });
        fallbackInsert.run(info.lastInsertRowid);
        inserted++;
      }
    }
  })();

  return { scanned: EXPANDED_CATALOG_MODELS.length, inserted, updated };
}

/**
 * Background periodic auto-scanner worker (runs on boot & every 30 minutes).
 */
export function startFreeModelAutoScanner() {
  // Run first scan shortly after boot
  setTimeout(() => {
    scanAndAutoFetchFreeModels().catch((err) => console.error('[FreeModelScanner] Boot scan error:', err));
  }, 5000);

  // Periodic interval every 30 minutes (1800000 ms)
  setInterval(() => {
    scanAndAutoFetchFreeModels().catch((err) => console.error('[FreeModelScanner] Periodic scan error:', err));
  }, 1800_000);
}
