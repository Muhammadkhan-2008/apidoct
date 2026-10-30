import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogPopup, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import { toast } from '@/lib/toast'
import { CheckCircle2, XCircle, Zap, Check, AlertCircle } from 'lucide-react'

export interface DiscoveredModel {
  id: string
  ownedBy: string | null
  registered: boolean
}

export interface ProbedModel extends DiscoveredModel {
  status?: 'working' | 'rejected'
  latencyMs?: number
  error?: string
}

interface DiscoverResponse {
  baseUrl: string
  keyId: number | null
  models: DiscoveredModel[]
  working?: ProbedModel[]
  rejected?: ProbedModel[]
  total: number
  workingCount?: number
  rejectedCount?: number
  registeredCount: number
}

export interface EndpointRef {
  keyId?: number
  baseUrl?: string
  apiKey?: string
  probe?: boolean
}

type TabType = 'working' | 'all' | 'rejected'

export function DiscoverModelsDialog({
  open,
  onOpenChange,
  endpoint,
  onRegistered,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  endpoint: EndpointRef
  onRegistered?: () => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<TabType>('working')

  const discover = useQuery<DiscoverResponse>({
    queryKey: ['custom-endpoint-models', endpoint.keyId ?? null, endpoint.baseUrl ?? null],
    queryFn: () => apiFetch('/api/keys/custom/discover-models', {
      method: 'POST',
      body: JSON.stringify({ ...endpoint, probe: true }),
    }),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  })

  const models = discover.data?.models ?? []
  const workingModels = discover.data?.working ?? []
  const rejectedModels = discover.data?.rejected ?? []
  const workingCount = discover.data?.workingCount ?? workingModels.length
  const rejectedCount = discover.data?.rejectedCount ?? rejectedModels.length

  const register = useMutation<{ created: number }>({
    meta: { silenceToast: true },
    mutationFn: () => apiFetch('/api/keys/custom', {
      method: 'POST',
      body: JSON.stringify({
        ...(endpoint.keyId === undefined ? { baseUrl: endpoint.baseUrl } : { keyId: endpoint.keyId }),
        ...(endpoint.apiKey ? { apiKey: endpoint.apiKey } : {}),
        models: [...selected],
      }),
    }),
    onSuccess: (data) => {
      for (const key of ['keys', 'health', 'fallback', 'models']) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      toast.success(t('keys.modelsAdded', { count: data.created }))
      onOpenChange(false)
      onRegistered?.()
    },
  })

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllWorking = () => {
    setSelected(prev => {
      const next = new Set(prev)
      for (const m of workingModels) {
        if (!m.registered) next.add(m.id)
      }
      return next
    })
  }

  const clearSelection = () => {
    setSelected(new Set())
  }

  const workingMap = useMemo(() => {
    const map = new Map<string, ProbedModel>()
    for (const w of workingModels) map.set(w.id, w)
    return map
  }, [workingModels])

  const rejectedMap = useMemo(() => {
    const map = new Map<string, ProbedModel>()
    for (const r of rejectedModels) map.set(r.id, r)
    return map
  }, [rejectedModels])

  const currentDisplayList = useMemo(() => {
    if (activeTab === 'working' && workingModels.length > 0) return workingModels
    if (activeTab === 'rejected' && rejectedModels.length > 0) return rejectedModels
    return models
  }, [activeTab, workingModels, rejectedModels, models])

  const newCount = selected.size

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup maxWidth="max-w-2xl">
        <DialogTitle className="flex items-center gap-2">
          <span>{t('keys.discoverTitle')}</span>
          {discover.isSuccess && (
            <span className="text-xs font-normal text-muted-foreground">
              ({discover.data.total} models probed)
            </span>
          )}
        </DialogTitle>
        <p className="mt-1 text-xs text-muted-foreground">{t('keys.discoverHint')}</p>

        {discover.isPending && (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="size-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-xs font-semibold text-foreground">
              Connecting & Live-Testing Models...
            </p>
            <p className="text-[11px] text-muted-foreground max-w-sm">
              ApiDoct is sending test requests to verify which models are actually working and measuring their response speeds.
            </p>
          </div>
        )}

        {discover.isError && (
          <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{(discover.error as Error).message}</span>
          </div>
        )}

        {discover.isSuccess && models.length === 0 && (
          <p className="mt-4 text-xs text-muted-foreground">{t('keys.discoverEmpty')}</p>
        )}

        {discover.isSuccess && models.length > 0 && (
          <div className="mt-4 space-y-3">
            {/* Summary Statistics Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  <span>{workingCount} Working</span>
                </span>
                <span className="text-muted-foreground/40">•</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <XCircle className="size-3.5 text-rose-500/80" />
                  <span>{rejectedCount} Rejected</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-6 text-[11px] px-2 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  onClick={selectAllWorking}
                >
                  <Check className="size-3 mr-1" />
                  Select All Working
                </Button>
                {newCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-6 text-[11px] px-2 text-muted-foreground"
                    onClick={clearSelection}
                  >
                    Clear ({newCount})
                  </Button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 border-b border-border/60 pb-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('working')}
                className={`px-3 py-1 font-semibold rounded-lg transition-colors ${
                  activeTab === 'working'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Working ({workingCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 font-semibold rounded-lg transition-colors ${
                  activeTab === 'all'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({models.length})
              </button>
              {rejectedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('rejected')}
                  className={`px-3 py-1 font-semibold rounded-lg transition-colors ${
                    activeTab === 'rejected'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Rejected ({rejectedCount})
                </button>
              )}
            </div>

            {/* Models Checkbox List */}
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40 custom-scrollbar">
              {currentDisplayList.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No models in this category.
                </div>
              ) : (
                currentDisplayList.map(model => {
                  const isWorking = workingMap.has(model.id)
                  const workingInfo = workingMap.get(model.id)
                  const rejectedInfo = rejectedMap.get(model.id)
                  const isChecked = model.registered || selected.has(model.id)

                  return (
                    <label
                      key={model.id}
                      className={`flex items-center gap-3 px-3 py-2.5 text-xs transition-colors ${
                        model.registered
                          ? 'bg-muted/40 opacity-70 cursor-default'
                          : 'cursor-pointer hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={model.registered}
                        onChange={() => toggle(model.id)}
                        className="size-4 rounded accent-primary text-primary focus:ring-primary/20 shrink-0"
                      />
                      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <code className="truncate font-mono font-semibold text-foreground" title={model.id}>
                            {model.id}
                          </code>
                          {isWorking && workingInfo?.latencyMs && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
                              <Zap className="size-2.5" />
                              {workingInfo.latencyMs}ms
                            </span>
                          )}
                          {model.registered && (
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {t('keys.discoverAlreadyAdded')}
                            </span>
                          )}
                        </div>
                        {rejectedInfo?.error && (
                          <span className="text-[11px] text-rose-500 truncate" title={rejectedInfo.error}>
                            ✖ {rejectedInfo.error}
                          </span>
                        )}
                        {model.ownedBy && !rejectedInfo?.error && (
                          <span className="text-[10px] text-muted-foreground">{model.ownedBy}</span>
                        )}
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        )}

        {register.isError && (
          <p className="mt-3 text-xs text-destructive">{(register.error as Error).message}</p>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-border/50 pt-3">
          <span className="text-xs text-muted-foreground">
            {newCount > 0 ? (
              <span className="font-semibold text-foreground">{newCount} model{newCount > 1 ? 's' : ''} selected</span>
            ) : (
              <span>Select models using the checkboxes</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={() => register.mutate()}
              disabled={newCount === 0 || register.isPending}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {register.isPending
                ? 'Adding...'
                : newCount === 1
                  ? 'Add 1 Model'
                  : `Add ${newCount} Selected Models`}
            </Button>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
