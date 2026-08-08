import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Sparkles, ShieldCheck, Zap, KeyRound, Award, CheckCircle2, Lock } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CardSkeleton } from '@/components/ui/skeleton'
import { usePremium } from '@/hooks/use-premium'

function fmtWhen(ms: number | null): string | null {
  if (!ms) return null
  return new Date(ms).toLocaleString()
}

export default function PremiumPage() {
  const queryClient = useQueryClient()
  const [keyInput, setKeyInput] = useState('')

  const { data, isLoading } = usePremium()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['premium'] })
    queryClient.invalidateQueries({ queryKey: ['models'] })
  }

  const activate = useMutation({
    meta: { silenceToast: true },
    mutationFn: (key: string) =>
      apiFetch('/api/premium/key', { method: 'POST', body: JSON.stringify({ key }) }),
    onSuccess: () => {
      setKeyInput('')
      invalidate()
    },
  })

  const removeKey = useMutation({
    mutationFn: () => apiFetch('/api/premium/key', { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const syncNow = useMutation({
    mutationFn: () => apiFetch('/api/premium/sync', { method: 'POST' }),
    onSuccess: invalidate,
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  const { hasKey, maskedKey, catalog } = data
  const live = catalog.appliedTier === 'live'

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <section className="glass-card rounded-3xl border border-white/10 p-8 shadow-2xl relative overflow-hidden bg-gradient-to-br from-indigo-950/60 via-purple-950/40 to-slate-950/80 backdrop-blur-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500/20 to-rose-500/10 text-amber-400 border border-amber-500/30 mb-3 shadow-md">
              <Sparkles className="size-3.5" />
              ApiDoct Enterprise Tier
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground bg-gradient-to-r from-white via-indigo-200 to-cyan-300 bg-clip-text text-transparent">
              ApiDoct Pro Engine & Real-Time Live Catalog
            </h1>
            <p className="text-xs text-muted-foreground mt-2 max-w-xl">
              Unlock instant zero-day AI model updates, ultra-low-latency consensus routing, and high-frequency catalog feed synchronization.
            </p>
          </div>
          <Button
            onClick={() => syncNow.mutate()}
            disabled={syncNow.isPending}
            className="bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 text-white font-bold rounded-2xl px-5 py-2.5 shadow-xl glow-indigo"
          >
            <RefreshCw className={`size-4 mr-2 ${syncNow.isPending ? 'animate-spin' : ''}`} />
            {syncNow.isPending ? 'Syncing Catalog...' : 'Check Catalog Updates'}
          </Button>
        </div>
      </section>

      {/* Catalog Status & License Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Catalog Sync Feed */}
        <section className="glass-card rounded-3xl border border-white/10 p-6 shadow-xl bg-card/60 backdrop-blur-xl">
          <h2 className="text-xs font-black uppercase tracking-widest text-indigo-300 flex items-center gap-2 mb-4">
            <Zap className="size-4 text-indigo-400" />
            Live Catalog Stream Status
          </h2>
          <div className="p-4 rounded-2xl border border-white/5 bg-accent/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">Active Feed Tier</span>
              <Badge variant={live ? 'default' : 'outline'} className="font-mono text-xs">
                {live ? '⚡ Live Real-Time Feed' : '📦 Local Snapshot Feed'}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-semibold">Applied Catalog Version</span>
              <span className="font-mono font-bold text-foreground">{catalog.appliedVersion ?? 'Local Standalone'}</span>
            </div>
            {catalog.lastSyncMs && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-semibold">Last Catalog Refresh</span>
                <span className="font-mono text-muted-foreground">{fmtWhen(catalog.lastSyncMs)}</span>
              </div>
            )}
          </div>
        </section>

        {/* Card 2: License Manager */}
        <section className="glass-card rounded-3xl border border-white/10 p-6 shadow-xl bg-card/60 backdrop-blur-xl">
          <h2 className="text-xs font-black uppercase tracking-widest text-amber-300 flex items-center gap-2 mb-4">
            <KeyRound className="size-4 text-amber-400" />
            ApiDoct Key Manager
          </h2>
          {hasKey ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" />
                    Pro Key Active
                  </p>
                  <p className="font-mono text-xs font-semibold text-foreground mt-1">{maskedKey}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => removeKey.mutate()} className="text-xs font-bold text-rose-400 hover:text-rose-300">
                  Remove Key
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={e => {
                e.preventDefault()
                if (keyInput.trim()) activate.mutate(keyInput.trim())
              }}
              className="space-y-3"
            >
              <Label htmlFor="key" className="text-xs font-bold text-foreground">License Key</Label>
              <div className="flex gap-2">
                <Input
                  id="key"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  placeholder="apidoct_pro_XXXXXXXXXXXXX"
                  className="bg-card/40 border-white/10 font-mono text-xs rounded-xl"
                />
                <Button type="submit" disabled={activate.isPending} className="bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold rounded-xl px-4 text-xs">
                  {activate.isPending ? 'Activating...' : 'Activate Pro'}
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>

      {/* Pro Features Showcase */}
      <section className="glass-card rounded-3xl border border-white/10 p-6 shadow-xl bg-card/60 backdrop-blur-xl">
        <h2 className="text-xs font-black uppercase tracking-widest text-emerald-300 flex items-center gap-2 mb-6">
          <Award className="size-4 text-emerald-400" />
          ApiDoct Pro Engine Architecture Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-white/5 bg-accent/10 space-y-2">
            <h3 className="text-xs font-extrabold text-foreground flex items-center gap-2">
              <Zap className="size-4 text-indigo-400" /> Zero-Day Model Ingestion
            </h3>
            <p className="text-[11px] text-muted-foreground">Receive brand-new AI providers and model weights within minutes of public announcement.</p>
          </div>
          <div className="p-4 rounded-2xl border border-white/5 bg-accent/10 space-y-2">
            <h3 className="text-xs font-extrabold text-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 text-cyan-400" /> Unlimited Local Router
            </h3>
            <p className="text-[11px] text-muted-foreground">Local fallback failover routing remains 100% free and open-source forever on your hardware.</p>
          </div>
          <div className="p-4 rounded-2xl border border-white/5 bg-accent/10 space-y-2">
            <h3 className="text-xs font-extrabold text-foreground flex items-center gap-2">
              <Lock className="size-4 text-emerald-400" /> Key Vault Encryption
            </h3>
            <p className="text-[11px] text-muted-foreground">Enterprise AES-GCM credential vault for multi-provider API keys.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
