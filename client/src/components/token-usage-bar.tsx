import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Zap, Activity } from 'lucide-react'
import { formatPercent, formatTokens, platformColors, type TokenUsageData } from '@/lib/routing'

const LEGEND_COLLAPSED_PX = 140

export function TokenUsageBar({ data }: { data: TokenUsageData }) {
  const { totalBudget, totalUsed, models } = data
  const remaining = Math.max(0, totalBudget - totalUsed)
  const remainingPct = totalBudget > 0 ? formatPercent(remaining / totalBudget) : '0%'

  const [expanded, setExpanded] = useState(false)
  const [collapsible, setCollapsible] = useState(false)
  const legendRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = legendRef.current
    if (!el) return
    const check = () => setCollapsible(el.scrollHeight > LEGEND_COLLAPSED_PX + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [models.length])

  const modelsWithWidth = models.map(m => {
    const usedTokens = m.used ?? 0
    const remainingTokens = Math.max(0, m.budget - usedTokens)
    return {
      ...m,
      usedTokens,
      remainingTokens,
      widthPct: totalBudget > 0 ? (remainingTokens / totalBudget) * 100 : 0,
    }
  })

  return (
    <section className="glass-card rounded-3xl border border-white/10 p-6 shadow-xl relative overflow-hidden bg-card/60 backdrop-blur-xl mb-6">
      {/* Background Accent Ambient Light */}
      <div className="absolute -right-20 -top-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Quick Telemetry Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md glow-indigo">
            <Zap className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-2">
              ApiDoct Active Inference Capacity
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                Live Pool
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">Aggregated provider tokens & quota allocation</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono font-semibold">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Available Tokens</span>
            <span className="text-sm font-bold gradient-text-indigo">{formatTokens(remaining)}</span>
          </div>
          <div className="h-7 w-px bg-border/50" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Monthly Capacity</span>
            <span className="text-sm font-bold text-foreground">{remainingPct} ({formatTokens(totalBudget)})</span>
          </div>
        </div>
      </div>

      {/* Electric Neon Capacity Meter */}
      <div className="space-y-2 mb-6">
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Activity className="size-3.5 text-cyan-400" />
            Model Quota Distribution
          </span>
          <span className="text-indigo-400 font-mono">{models.length} Models Active</span>
        </div>
        <div className="flex h-3.5 rounded-2xl overflow-hidden bg-accent/30 p-0.5 border border-white/10 glow-cyan">
          {modelsWithWidth.map((m, i) => (
            <div
              key={i}
              title={`${m.displayName} (${m.platform}): ${formatTokens(m.remainingTokens)} remaining`}
              className="h-full rounded-lg transition-all duration-300 hover:opacity-85"
              style={{
                width: `${m.widthPct}%`,
                backgroundColor: platformColors[m.platform] ?? '#6366f1',
              }}
            />
          ))}
        </div>
      </div>

      {/* Model Capacity Grid Legend */}
      <div
        ref={legendRef}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={collapsible ? { maxHeight: expanded ? legendRef.current?.scrollHeight : LEGEND_COLLAPSED_PX } : undefined}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs font-mono">
          {modelsWithWidth.map((m, i) => (
            <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl bg-card/40 border border-border/40 hover:border-indigo-500/30 transition-all hover:scale-[1.01]">
              <span
                className="size-2.5 rounded-full flex-shrink-0 shadow-sm"
                style={{ backgroundColor: platformColors[m.platform] ?? '#6366f1' }}
              />
              <span className="truncate font-semibold font-sans text-foreground">{m.displayName}</span>
              <span className="flex-1" />
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono text-[11px]">
                {formatTokens(m.remainingTokens)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl border border-border/30 bg-accent/20 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>{expanded ? 'Show Less' : `Show all ${models.length} models`}</span>
          <ChevronDown className={`size-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </section>
  )
}
