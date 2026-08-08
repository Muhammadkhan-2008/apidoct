import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Boxes, Search, X, Cpu, Zap, ShieldCheck, Layers, Gauge } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { apiFetch } from '@/lib/api'
import {
  buildGroups,
  groupMaxContext,
  type FallbackEntry,
  type RoutingData,
  type RoutingStrategy,
  type RoutingWeights,
  type Row,
  type TokenUsageData,
} from '@/lib/routing'
import { Button } from '@/components/ui/button'
import { CustomWeightsPopover } from '@/components/custom-weights-popover'
import { EmptyState } from '@/components/empty-state'
import { GettingStarted } from '@/components/getting-started'
import { ModelTableHead, SortableGroupRow } from '@/components/model-table'
import { TableSkeleton } from '@/components/ui/skeleton'
import { TokenUsageBar } from '@/components/token-usage-bar'
import { FloatingBar } from '@/components/floating-bar'
import { ModelsTabs } from '@/components/models-tabs'
import { Tooltip } from '@/components/tooltip'
import { PenaltyInspector } from '@/components/penalty-inspector'

const STRATEGIES: { key: RoutingStrategy; tKey: string; label: string; icon: any }[] = [
  { key: 'priority', tKey: 'manual', label: 'Priority Chain', icon: Zap },
  { key: 'balanced', tKey: 'balanced', label: 'Balanced Load', icon: Layers },
  { key: 'smartest', tKey: 'smartest', label: 'Max Intelligence', icon: Cpu },
  { key: 'fastest', tKey: 'fastest', label: 'Lowest Latency', icon: Gauge },
  { key: 'reliable', tKey: 'reliable', label: 'High Availability', icon: ShieldCheck },
  { key: 'custom', tKey: 'custom', label: 'Custom Matrix', icon: Layers },
]

const CTX_BUCKETS: { key: number; label?: string; tKey?: string }[] = [
  { key: 0, tKey: 'ctxAny' },
  { key: 32_000, label: '32K+' },
  { key: 128_000, label: '128K+' },
  { key: 1_000_000, label: '1M+' },
]

const RENDER_CHUNK = 50

export default function FallbackPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [localEntries, setLocalEntries] = useState<FallbackEntry[] | null>(null)

  const [search, setSearch] = useState('')
  const [filterVision, setFilterVision] = useState(false)
  const [filterTools, setFilterTools] = useState(false)
  const [minContext, setMinContext] = useState(0)

  const { data: entries = [], isLoading } = useQuery<FallbackEntry[]>({
    queryKey: ['fallback'],
    queryFn: () => apiFetch('/api/fallback'),
  })

  const { data: tokenUsage } = useQuery<TokenUsageData>({
    queryKey: ['fallback', 'token-usage'],
    queryFn: () => apiFetch('/api/fallback/token-usage'),
  })

  const { data: routing } = useQuery<RoutingData>({
    queryKey: ['fallback', 'routing'],
    queryFn: () => apiFetch('/api/fallback/routing'),
    refetchInterval: 15_000,
  })

  const saveMutation = useMutation({
    mutationFn: (newEntries: FallbackEntry[]) =>
      apiFetch('/api/fallback', {
        method: 'PUT',
        body: JSON.stringify(newEntries),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
    },
  })

  const strategyMutation = useMutation({
    mutationFn: ({ strategy, weights }: { strategy: RoutingStrategy; weights?: RoutingWeights }) =>
      apiFetch('/api/fallback/routing', {
        method: 'PUT',
        body: JSON.stringify({ strategy, weights }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
      queryClient.invalidateQueries({ queryKey: ['fallback', 'routing'] })
    },
  })

  const currentEntries = localEntries ?? entries
  const strategy = routing?.strategy ?? 'priority'
  const isManual = strategy === 'priority'
  const hasChanges = Boolean(localEntries)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const scoresByDbId = new Map(routing?.scores.map(s => [s.modelDbId, s]))
  const rows: Row[] = currentEntries.map(e => ({
    ...e,
    ...scoresByDbId.get(e.modelDbId),
  }))

  const allGroups = buildGroups(rows, isManual)

  function handleGroupedDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeKey = String(active.id).replace(/^grp:/, '')
    const overKey = String(over.id).replace(/^grp:/, '')

    const activeGrp = allGroups.find(g => g.key === activeKey)
    const overGrp = allGroups.find(g => g.key === overKey)
    if (!activeGrp || !overGrp) return

    const oldIndex = currentEntries.findIndex(e => e.modelDbId === activeGrp.members[0].modelDbId)
    const newIndex = currentEntries.findIndex(e => e.modelDbId === overGrp.members[0].modelDbId)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(currentEntries, oldIndex, newIndex)
    setLocalEntries(reordered)
  }

  function handleGroupToggle(memberIds: number[], enabled: boolean) {
    const ids = new Set(memberIds)
    const next = currentEntries.map(e => (ids.has(e.modelDbId) ? { ...e, enabled } : e))
    setLocalEntries(next)
    saveMutation.mutate(next)
  }

  function handleSave() {
    if (!localEntries) return
    saveMutation.mutate(localEntries, {
      onSuccess: () => setLocalEntries(null),
    })
  }

  const searchedGroups = allGroups.filter(g => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      g.label.toLowerCase().includes(q) ||
      g.members.some(m => m.modelId.toLowerCase().includes(q) || m.platform?.toLowerCase().includes(q))
    )
  })

  const filteredGroups = searchedGroups.filter(g => {
    if (filterVision && !g.members.some(m => m.supportsVision)) return false
    if (filterTools && !g.members.some(m => m.supportsTools)) return false
    if (minContext > 0 && groupMaxContext(g.members) < minContext) return false
    return true
  })

  const [visibleLimit, setVisibleLimit] = useState(RENDER_CHUNK)
  useEffect(() => { setVisibleLimit(RENDER_CHUNK) }, [search, filterVision, filterTools, minContext, strategy])

  const observerTarget = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = observerTarget.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleLimit(prev => Math.min(prev + RENDER_CHUNK, filteredGroups.length))
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [filteredGroups.length])

  const visibleGroups = filteredGroups.slice(0, visibleLimit)
  const rankByKey = new Map<string, number>()
  filteredGroups.forEach((g, i) => rankByKey.set(g.key, i + 1))

  const scanFreeModelsMutation = useMutation({
    mutationFn: () => apiFetch<{ scanned: number; inserted: number; updated: number }>('/api/fallback/scan-free-models', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
    },
  })

  return (
    <div className="space-y-6">
      <ModelsTabs />

      {tokenUsage && <TokenUsageBar data={tokenUsage} />}

      <GettingStarted />

      {/* ApiDoct Smart Routing Matrix Control Card */}
      <section className="glass-card rounded-3xl border border-white/10 p-6 shadow-xl relative overflow-hidden bg-card/60 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-border/40">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <Zap className="size-5 text-indigo-400" />
              ApiDoct Dynamic Routing Matrix
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select an intelligent routing algorithm or configure custom weighted failover priorities.
            </p>
          </div>
          <Button
            onClick={() => scanFreeModelsMutation.mutate()}
            disabled={scanFreeModelsMutation.isPending}
            className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-indigo-600 text-white font-bold rounded-2xl text-xs px-4 py-2 shadow-lg glow-emerald"
          >
            ⚡ {scanFreeModelsMutation.isPending ? 'Scanning Free Models...' : 'Auto-Fetch Live Free Models'}
          </Button>
        </div>

        <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-border/40 p-1.5 bg-accent/20">
          {STRATEGIES.map(s => {
            const Icon = s.icon
            const isActive = s.key === strategy
            return (
              <Tooltip key={s.key} text={t(`strategies.${s.tKey}Blurb`)}>
                <button
                  disabled={strategyMutation.isPending}
                  onClick={() => strategyMutation.mutate({ strategy: s.key })}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs rounded-xl font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 text-white shadow-lg glow-indigo'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{s.label}</span>
                </button>
              </Tooltip>
            )
          })}
          {strategy === 'custom' && routing && (
            <CustomWeightsPopover
              saved={routing.customWeights}
              saving={strategyMutation.isPending}
              onSave={w => strategyMutation.mutate({ strategy: 'custom', weights: w })}
            />
          )}
        </div>
      </section>

      <PenaltyInspector />

      {/* Catalog Search & Filters Bar */}
      <div className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-md">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-indigo-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter models by provider, context, or capabilities..."
            className="w-full rounded-xl border border-border/40 bg-card/50 py-2 pl-10 pr-9 text-xs outline-none transition-all focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterVision(v => !v)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
              filterVision
                ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-sm'
                : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/30'
            }`}
          >
            👁️ Vision
          </button>
          <button
            onClick={() => setFilterTools(v => !v)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
              filterTools
                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-sm'
                : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/30'
            }`}
          >
            🛠️ Function Tools
          </button>

          <div className="inline-flex items-center gap-1 rounded-xl border border-border/40 p-1 bg-card/40">
            {CTX_BUCKETS.map(b => (
              <button
                key={b.key}
                onClick={() => setMinContext(b.key)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  minContext === b.key
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {b.tKey ? 'Any Context' : b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Model Routing Table */}
      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={t('models.noModelsTitle')}
          description={<>{t('models.noModelsBefore')}<Link to="/keys" className="underline text-indigo-400 font-semibold">{t('models.keysPageLink')}</Link>{t('models.noModelsAfter')}</>}
          action={
            <Link to="/keys">
              <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-medium">{t('setup.step1Cta')}</Button>
            </Link>
          }
        />
      ) : (
        <div className="glass-card rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupedDragEnd}>
            <SortableContext items={visibleGroups.map(g => `grp:${g.key}`)} strategy={verticalListSortingStrategy}>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <ModelTableHead />
                  <tbody>
                    {visibleGroups.map((group) => (
                      <SortableGroupRow
                        key={group.key}
                        group={group}
                        rank={rankByKey.get(group.key) ?? 0}
                        onToggleGroup={handleGroupToggle}
                        allRows={rows}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </SortableContext>
          </DndContext>
          <div ref={observerTarget} className="h-4" />
        </div>
      )}

      <FloatingBar show={hasChanges}>
        <span className="text-xs text-muted-foreground">{t('common.unsavedChanges')}</span>
        <Button variant="outline" size="sm" onClick={() => setLocalEntries(null)}>{t('common.discard')}</Button>
        <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="bg-gradient-to-r from-indigo-600 to-cyan-600 text-white">
          {saveMutation.isPending ? t('common.saving') : t('common.saveChanges')}
        </Button>
      </FloatingBar>
    </div>
  )
}
