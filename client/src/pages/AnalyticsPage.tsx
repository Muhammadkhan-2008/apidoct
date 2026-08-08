import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { X, Activity, Zap, CheckCircle2, ArrowUpRight, DollarSign, Clock } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogClose, DialogPopup, DialogTitle } from '@/components/ui/dialog'
import { Tooltip } from '@/components/tooltip'
import { formatSqliteUtcToLocalTime } from '@/lib/utils'
import { platformColors } from '@/lib/routing'
import { InferenceCapacityCard } from '@/components/usage-summary-card'

type TimeRange = '24h' | '7d' | '30d' | '90d'
const TIME_RANGES: TimeRange[] = ['24h', '7d', '30d', '90d']
const RANGE_KEY = 'analytics.range'

function storedRange(): TimeRange {
  try {
    const v = localStorage.getItem(RANGE_KEY)
    if (v && (TIME_RANGES as string[]).includes(v)) return v as TimeRange
  } catch { /* ignore */ }
  return '7d'
}

interface SummaryResponse {
  totalRequests: number
  successRate: number
  totalInputTokens: number
  totalOutputTokens: number
  avgLatencyMs: number
  p50LatencyMs: number | null
  p95LatencyMs: number | null
  avgTtfbMs: number | null
  requestTypeCounts: { chat: number; embedding: number }
  estimatedCostSavings: number
  pinnedRequests: number
  pinHonoredRequests: number
  firstRequestAt: string | null
  lifetimeTotalRequests: number
}

interface ByPlatformRow {
  platform: string
  requests: number
  successRate: number
  avgLatencyMs: number
  p95LatencyMs: number | null
  avgTtfbMs: number | null
  errorCount: number
  avgTokensPerSecond: number | null
  totalInputTokens: number
  totalOutputTokens: number
}

interface TimelineBucket {
  timestamp: string
  requests: number
  successCount: number
  failureCount: number
  inputTokens: number
  outputTokens: number
}

interface RecentCallRow {
  id: number
  platform: string
  modelId: string
  requestedModel: string | null
  requestType: string
  status: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  error: string | null
  clientIp: string | null
  clientUserAgent: string | null
  createdAt: string
  attemptCount: number
}

interface RecentCallsResponse {
  total: number
  rows: RecentCallRow[]
}

interface RequestAttempt {
  ordinal: number
  platform: string
  modelId: string
  keyOrdinal: number
  outcome: string
  startOffsetMs: number
  durationMs: number
  errorSummary: string | null
}

interface RequestDetail extends Omit<RecentCallRow, 'attemptCount'> {
  ttfbMs: number | null
  attempts: RequestAttempt[]
}

function formatTokens(n?: number): string {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function Stat({ label, value, hint, icon: Icon, color = 'indigo' }: { label: string; value: string | number; hint?: string; icon?: any; color?: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-500/20 via-purple-500/10 to-transparent border-indigo-500/30 text-indigo-400',
    emerald: 'from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/30 text-emerald-400',
    cyan: 'from-cyan-500/20 via-blue-500/10 to-transparent border-cyan-500/30 text-cyan-400',
    amber: 'from-amber-500/20 via-orange-500/10 to-transparent border-amber-500/30 text-amber-400',
    purple: 'from-purple-500/20 via-pink-500/10 to-transparent border-purple-500/30 text-purple-400',
  }

  const card = (
    <div className={`glass-card rounded-2xl border p-4.5 bg-gradient-to-br ${colorMap[color] || colorMap.indigo} shadow-lg transition-all duration-300 hover:scale-[1.02]`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 opacity-80" />}
      </div>
      <p className="text-2xl font-black tabular-nums mt-2 text-foreground">{value}</p>
    </div>
  )
  return hint ? <Tooltip text={hint} side="bottom" className="block">{card}</Tooltip> : card
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border/40 bg-accent/10 flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-indigo-300 flex items-center gap-2">
          <Activity className="size-4 text-indigo-400" />
          {title}
        </h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function PlatformDot({ platform }: { platform: string }) {
  return (
    <span
      className="size-2.5 rounded-full flex-shrink-0 shadow-sm"
      style={{ backgroundColor: platformColors[platform] ?? '#94a3b8' }}
    />
  )
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`
  return `${ms} ms`
}

function DetailField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-xs font-semibold mt-1 break-words ${mono ? 'tabular-nums font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function RequestDetailDialog({ requestId, onClose }: { requestId: number | null; onClose: () => void }) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['analytics', 'request-detail', requestId],
    queryFn: () => apiFetch<RequestDetail>(`/api/analytics/requests/${requestId}`),
    enabled: requestId != null,
  })

  return (
    <Dialog open={requestId != null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogPopup className="sm:max-w-2xl glass-card rounded-3xl border-white/10 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-border/40">
          <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-foreground">
            <Zap className="size-4 text-indigo-400" />
            ApiDoct Request Trace #{requestId}
          </DialogTitle>
          <DialogClose className="rounded-xl p-1 text-muted-foreground hover:text-foreground hover:bg-accent/40">
            <X className="size-4" />
          </DialogClose>
        </div>

        {isLoading || !detail ? (
          <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">Loading telemetry trace...</div>
        ) : (
          <div className="space-y-6 pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-card/40 border border-white/5">
              <DetailField label="Status" value={
                <Badge variant={detail.status === 'success' ? 'default' : 'destructive'} className="font-mono text-[10px]">
                  {detail.status}
                </Badge>
              } />
              <DetailField label="Latency" value={`${detail.latencyMs} ms`} mono />
              <DetailField label="Tokens" value={`${detail.inputTokens} in / ${detail.outputTokens} out`} mono />
              <DetailField label="TTFB" value={detail.ttfbMs != null ? `${detail.ttfbMs} ms` : '—'} mono />
            </div>

            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-indigo-300 mb-3">Routing Ladder Attempts</h4>
              <div className="space-y-2">
                {detail.attempts.map((att) => (
                  <div key={att.ordinal} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-accent/10 text-xs">
                    <div className="flex items-center gap-2.5">
                      <PlatformDot platform={att.platform} />
                      <span className="font-mono font-bold text-foreground">{att.modelId}</span>
                      <span className="text-[10px] text-muted-foreground">({att.platform})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-muted-foreground">{formatMs(att.durationMs)}</span>
                      <Badge variant={att.outcome === 'success' ? 'default' : 'outline'} className="text-[10px] font-mono">
                        {att.outcome}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogPopup>
    </Dialog>
  )
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<TimeRange>(storedRange)
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)

  function updateRange(next: TimeRange) {
    setRange(next)
    try { localStorage.setItem(RANGE_KEY, next) } catch {}
  }

  const { data: summary } = useQuery<SummaryResponse>({
    queryKey: ['analytics', 'summary', range],
    queryFn: () => apiFetch(`/api/analytics/summary?range=${range}`),
  })

  const { data: byPlatform = [] } = useQuery<ByPlatformRow[]>({
    queryKey: ['analytics', 'by-platform', range],
    queryFn: () => apiFetch(`/api/analytics/by-platform?range=${range}`),
  })

  const { data: timeline = [] } = useQuery<TimelineBucket[]>({
    queryKey: ['analytics', 'timeline', range],
    queryFn: () => apiFetch(`/api/analytics/timeline?range=${range}`),
  })

  const { data: recentCalls } = useQuery<RecentCallsResponse>({
    queryKey: ['analytics', 'recent-calls', range],
    queryFn: () => apiFetch(`/api/analytics/recent-calls?range=${range}&limit=50`),
  })

  const successRateText = summary ? `${(summary.successRate * 100).toFixed(1)}%` : '—'
  const savingsText = summary ? `$${summary.estimatedCostSavings.toFixed(2)}` : '—'

  return (
    <div className="space-y-6">
      {/* Top Bar with Time Range */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 rounded-3xl border border-white/10">
        <div>
          <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
            <Activity className="size-5 text-indigo-400" />
            ApiDoct Telemetry & Performance Matrix
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time metrics, provider latency breakdown, and token usage accounting.</p>
        </div>
        <div className="inline-flex rounded-2xl border border-border/40 p-1 bg-card/40">
          {TIME_RANGES.map(r => (
            <button
              key={r}
              onClick={() => updateRange(r)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                range === r
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Inference Capacity & Active Pool Card */}
      <InferenceCapacityCard />

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        <Stat label="Requests" value={summary?.totalRequests ?? 0} icon={Zap} color="indigo" />
        <Stat label="Success Rate" value={successRateText} icon={CheckCircle2} color="emerald" />
        <Stat label="Input Tokens" value={formatTokens(summary?.totalInputTokens)} icon={ArrowUpRight} color="cyan" />
        <Stat label="Output Tokens" value={formatTokens(summary?.totalOutputTokens)} icon={ArrowUpRight} color="purple" />
        <Stat label="Avg Latency" value={summary?.avgLatencyMs ? `${summary.avgLatencyMs} ms` : '—'} icon={Clock} color="amber" />
        <Stat label="Est. Savings" value={savingsText} icon={DollarSign} color="emerald" />
      </div>

      {/* Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Requests Over Time">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <ChartTooltip contentStyle={{ backgroundColor: '#090d16', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                <Line type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Requests By Provider">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPlatform}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="platform" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <ChartTooltip contentStyle={{ backgroundColor: '#090d16', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                <Bar dataKey="requests" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Per-Provider Table */}
      <Panel title="Per-Provider Performance Breakdown">
        <div className="overflow-x-auto custom-scrollbar">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="border-border/40">
                <TableHead className="font-bold text-muted-foreground">Provider</TableHead>
                <TableHead className="font-bold text-muted-foreground">Requests</TableHead>
                <TableHead className="font-bold text-muted-foreground">Success Rate</TableHead>
                <TableHead className="font-bold text-muted-foreground">Avg Latency</TableHead>
                <TableHead className="font-bold text-muted-foreground">P95 Latency</TableHead>
                <TableHead className="font-bold text-muted-foreground">In Tokens</TableHead>
                <TableHead className="font-bold text-muted-foreground">Out Tokens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byPlatform.map(p => (
                <TableRow key={p.platform} className="border-border/20 hover:bg-accent/20">
                  <TableCell className="font-extrabold flex items-center gap-2">
                    <PlatformDot platform={p.platform} />
                    <span className="capitalize">{p.platform}</span>
                  </TableCell>
                  <TableCell className="font-mono font-bold">{p.requests}</TableCell>
                  <TableCell className="font-mono text-emerald-400 font-bold">{(p.successRate * 100).toFixed(1)}%</TableCell>
                  <TableCell className="font-mono">{p.avgLatencyMs} ms</TableCell>
                  <TableCell className="font-mono">{p.p95LatencyMs ?? '—'} ms</TableCell>
                  <TableCell className="font-mono">{formatTokens(p.totalInputTokens)}</TableCell>
                  <TableCell className="font-mono">{formatTokens(p.totalOutputTokens)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      {/* Recent Calls Trace with Per-Model Token Breakdown & Timestamps */}
      <Panel title="Model Token Usage Telemetry & Time Audit Log">
        <div className="overflow-x-auto custom-scrollbar">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="border-border/40">
                <TableHead className="font-bold text-muted-foreground">Time (Timestamp)</TableHead>
                <TableHead className="font-bold text-muted-foreground">Model ID</TableHead>
                <TableHead className="font-bold text-muted-foreground">Provider</TableHead>
                <TableHead className="font-bold text-muted-foreground">Prompt (In)</TableHead>
                <TableHead className="font-bold text-muted-foreground">Completion (Out)</TableHead>
                <TableHead className="font-bold text-muted-foreground">Total Tokens Used</TableHead>
                <TableHead className="font-bold text-muted-foreground">Latency</TableHead>
                <TableHead className="font-bold text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentCalls?.rows.map(call => {
                const totalTokens = (call.inputTokens || 0) + (call.outputTokens || 0)
                return (
                  <TableRow
                    key={call.id}
                    onClick={() => setSelectedRequestId(call.id)}
                    className="border-border/20 hover:bg-indigo-500/10 cursor-pointer transition-colors"
                  >
                    <TableCell className="font-mono text-[11px] text-cyan-400 font-bold">
                      {formatSqliteUtcToLocalTime(call.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono font-extrabold text-foreground">{call.modelId}</TableCell>
                    <TableCell className="font-semibold flex items-center gap-2">
                      <PlatformDot platform={call.platform} />
                      <span className="capitalize text-xs">{call.platform}</span>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">{formatTokens(call.inputTokens)}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{formatTokens(call.outputTokens)}</TableCell>
                    <TableCell className="font-mono font-extrabold text-emerald-400">
                      {formatTokens(totalTokens)}
                    </TableCell>
                    <TableCell className="font-mono text-amber-400 font-bold">{call.latencyMs} ms</TableCell>
                    <TableCell>
                      <Badge variant={call.status === 'success' ? 'default' : 'destructive'} className="font-mono text-[10px]">
                        {call.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <RequestDetailDialog requestId={selectedRequestId} onClose={() => setSelectedRequestId(null)} />
    </div>
  )
}
