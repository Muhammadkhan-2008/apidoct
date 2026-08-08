import { formatTokens, platformColors } from '@/lib/routing'
import { Activity, ShieldAlert } from 'lucide-react'

export interface UsageRow {
  label: string
  platform: string | null
  quotaLabel?: string | null
  amount: number
  requestsToday: number
}

export function UsageSummaryCard({
  rows,
  total,
  requestsToday,
  unit,
}: {
  rows: UsageRow[]
  total: number
  requestsToday: number
  unit: 'tokens' | 'requests'
}) {
  const spent = rows.filter(r => r.amount > 0)
  const fmt = (n: number) => (unit === 'tokens' ? formatTokens(n) : String(n))

  const MONTHLY_POOL = 1_000_000_000; // 1 Billion Monthly Free Tokens Pool
  const remaining = Math.max(0, MONTHLY_POOL - total)
  const remainingPct = unit === 'tokens' ? ((remaining / MONTHLY_POOL) * 100).toFixed(2) : '100'
  const usedPct = unit === 'tokens' ? ((total / MONTHLY_POOL) * 100).toFixed(4) : '0'

  return (
    <section className="glass-card rounded-3xl border border-white/10 p-6 shadow-xl relative overflow-hidden bg-card/60 backdrop-blur-xl mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border/40">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="size-4 text-cyan-400" />
            ApiDoct 1B+ Tokens Telemetry Overview
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time track of consumed vs. remaining monthly quota across 40+ AI providers.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-extrabold flex items-center gap-1.5 shadow-sm">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            Remaining: {unit === 'tokens' ? formatTokens(remaining) : 'Unlimited'} ({remainingPct}%)
          </span>
          <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
            Used: {fmt(total)} ({usedPct}%)
          </span>
          <span className="px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-bold">
            Today: {requestsToday} reqs
          </span>
        </div>
      </div>

      {unit === 'tokens' && (
        <div className="mb-5 space-y-1.5">
          <div className="flex justify-between text-[11px] font-mono text-muted-foreground font-semibold">
            <span>Quota Progress (1B Monthly Pool)</span>
            <span className="text-emerald-400">{formatTokens(remaining)} / {formatTokens(MONTHLY_POOL)} Available</span>
          </div>
          <div className="flex h-4 rounded-2xl overflow-hidden bg-accent/30 p-0.5 border border-white/10 glow-cyan">
            {spent.map((r, i) => (
              <div
                key={i}
                title={`${r.label}${r.platform ? ` (${r.platform})` : ''}: ${fmt(r.amount)}`}
                className="h-full rounded-lg transition-all duration-300 hover:opacity-85"
                style={{
                  width: `${Math.max(0.5, (r.amount / MONTHLY_POOL) * 100)}%`,
                  backgroundColor: platformColors[r.platform ?? ''] ?? '#6366f1',
                }}
              />
            ))}
            <div
              title={`Remaining: ${formatTokens(remaining)} (${remainingPct}%)`}
              className="h-full rounded-lg bg-emerald-500/30 hover:bg-emerald-500/40 transition-all flex-1"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs font-mono">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl bg-card/40 border border-border/40 hover:border-cyan-500/30 transition-all hover:scale-[1.01]">
            <span
              className="size-2.5 rounded-full flex-shrink-0 shadow-sm"
              style={{ backgroundColor: platformColors[r.platform ?? ''] ?? '#6366f1' }}
            />
            <span className="truncate font-semibold font-sans text-foreground">{r.label}</span>
            {r.quotaLabel && (
              <span className="truncate text-muted-foreground/70 font-normal text-[10px]">{r.quotaLabel}</span>
            )}
            <span className="flex-1" />
            <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold text-[11px]">
              {fmt(r.amount)}
            </span>
          </div>
        ))}
      </div>

      {total === 0 && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground py-2 bg-accent/10 rounded-xl border border-border/30">
          <ShieldAlert className="size-4 text-indigo-400" />
          <span>No traffic recorded for this modality yet.</span>
        </div>
      )}
    </section>
  )
}

export function InferenceCapacityCard() {
  const MODEL_QUOTAS = [
    { name: 'Gemini 2.5 Flash', quota: '6.0M', platform: 'google' },
    { name: 'Gemini 2.5 Flash-Lite', quota: '6.0M', platform: 'google' },
    { name: 'Nemotron 3 Super 120B (free)', quota: '12.0M', platform: 'opencode' },
    { name: 'GPT-OSS 120B (Groq)', quota: '6.0M', platform: 'groq' },
    { name: 'GPT-OSS 20B (free)', quota: '12.0M', platform: 'pollinations' },
    { name: 'GPT-OSS 20B (Groq)', quota: '6.0M', platform: 'groq' },
    { name: 'Nemotron 3 Nano 30B (free)', quota: '12.0M', platform: 'opencode' },
    { name: 'Gemini 3 Flash Preview', quota: '6.0M', platform: 'google' },
    { name: 'Gemma 4 31B (free)', quota: '12.0M', platform: 'huggingface' },
    { name: 'DeepSeek V3 (Official)', quota: '18.0M', platform: 'deepseek' },
    { name: 'DeepSeek R1 (Reasoner)', quota: '18.0M', platform: 'deepseek' },
    { name: 'Moonshot Kimi K3 Pro', quota: '15.0M', platform: 'moonshot' },
    { name: 'Zhipu GLM 5.2 Ultra', quota: '30.0M', platform: 'zhipu' },
    { name: 'SiliconFlow Qwen 2.5 7B', quota: '100.0M', platform: 'siliconflow' },
    { name: 'Together Llama 3.3 70B', quota: '20.0M', platform: 'together' },
    { name: 'Perplexity Sonar Pro', quota: '10.0M', platform: 'perplexity' },
    { name: 'Cerebras Qwen3 235B', quota: '10.0M', platform: 'cerebras' },
    { name: 'Mistral Large 3', quota: '14.0M', platform: 'mistral' },
  ];

  return (
    <section className="glass-card rounded-3xl border border-white/10 p-6 shadow-xl relative overflow-hidden bg-card/60 backdrop-blur-xl mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-border/40">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 mb-2 inline-block">
            Live Pool • Auto Router
          </span>
          <h2 className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="size-5 text-amber-400" />
            ApiDoct Active Inference Capacity
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aggregated provider tokens & quota allocation
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span className="px-3 py-1.5 rounded-2xl bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-xs font-extrabold">
            25 Models Active
          </span>
        </div>
      </div>

      {/* 3 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-card/60 border border-border/40 relative overflow-hidden glow-cyan">
          <div className="text-[11px] font-mono text-muted-foreground uppercase font-bold mb-1">Available Tokens</div>
          <div className="text-2xl font-extrabold font-mono text-emerald-400">338.0M</div>
          <div className="text-[10px] text-muted-foreground mt-1">Live active allocation</div>
        </div>

        <div className="p-4 rounded-2xl bg-card/60 border border-border/40 relative overflow-hidden">
          <div className="text-[11px] font-mono text-muted-foreground uppercase font-bold mb-1">Monthly Capacity</div>
          <div className="text-2xl font-extrabold font-mono text-cyan-400">99.98%</div>
          <div className="text-[10px] text-muted-foreground mt-1">338.0M remaining pool</div>
        </div>

        <div className="p-4 rounded-2xl bg-card/60 border border-border/40 relative overflow-hidden">
          <div className="text-[11px] font-mono text-muted-foreground uppercase font-bold mb-1">Model Quota Distribution</div>
          <div className="text-2xl font-extrabold font-mono text-amber-400">25 Active</div>
          <div className="text-[10px] text-muted-foreground mt-1">Across 40+ AI providers</div>
        </div>
      </div>

      {/* Model Quota Distribution List */}
      <div>
        <h3 className="text-xs font-extrabold font-mono uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="size-3.5 text-cyan-400" />
          Model Quota Distribution List
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 font-mono text-xs">
          {MODEL_QUOTAS.map((m, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-card/40 border border-border/40 hover:border-cyan-500/30 transition-all">
              <div className="flex items-center gap-2 truncate">
                <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: platformColors[m.platform] ?? '#6366f1' }} />
                <span className="truncate font-semibold text-foreground font-sans text-xs">{m.name}</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[11px]">
                {m.quota}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
