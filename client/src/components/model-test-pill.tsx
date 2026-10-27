import { useState } from 'react'
import { Zap, CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogPopup, DialogTitle } from '@/components/ui/dialog'
import type { Row } from '@/lib/routing'

interface TestResult {
  success: boolean
  status: number
  latencyMs: number
  content?: string
  error?: string
  keyLabel?: string
  keyCount?: number
  platform: string
  modelId: string
  displayName: string
  timestamp: string
}

export function ModelTestPill({ model, compact = false }: { model: Row; compact?: boolean }) {
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const handleTest = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    setLoading(true)
    try {
      const res = await apiFetch<TestResult>('/api/models/test', {
        method: 'POST',
        body: JSON.stringify({
          modelDbId: model.modelDbId,
          platform: model.platform,
          modelId: model.modelId,
          prompt: 'Say "ApiDoct OK" in 3 words.',
        }),
      })
      setResult(res)
    } catch (err: any) {
      setResult({
        success: false,
        status: 500,
        latencyMs: 0,
        error: err?.message || 'Network test failed',
        platform: model.platform,
        modelId: model.modelId,
        displayName: model.displayName,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <button
            disabled
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono text-[11px] animate-pulse"
          >
            <Loader2 className="size-3 animate-spin text-indigo-400" />
            <span>Pinging...</span>
          </button>
        ) : result ? (
          <button
            onClick={() => setShowModal(true)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[11px] font-semibold transition-all hover:scale-105 ${
              result.success
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25'
                : result.status === 429
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25'
                : 'bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500/25'
            }`}
            title="Click to view full test response details"
          >
            {result.success ? (
              <CheckCircle2 className="size-3 text-emerald-400" />
            ) : result.status === 429 ? (
              <AlertTriangle className="size-3 text-amber-400" />
            ) : (
              <XCircle className="size-3 text-rose-400" />
            )}
            <span>
              {result.success
                ? `${result.latencyMs}ms`
                : result.status === 429
                ? '429 RateLimit'
                : result.status === 401
                ? 'No Key'
                : 'Failed'}
            </span>
          </button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            className={`font-semibold border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/15 hover:text-white rounded-lg transition-all ${
              compact ? 'h-6 px-2 text-[10px]' : 'h-7 px-2.5 text-xs'
            }`}
          >
            <Zap className="size-3 text-amber-400 mr-1" />
            <span>Test</span>
          </Button>
        )}
      </div>

      {/* Test Result Inspector Modal */}
      {result && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogPopup maxWidth="max-w-md">
            <div className="space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-xl border ${
                      result.success
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : result.status === 429
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle2 className="size-5" />
                    ) : result.status === 429 ? (
                      <AlertTriangle className="size-5" />
                    ) : (
                      <XCircle className="size-5" />
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-sm font-extrabold truncate max-w-xs">
                      {result.displayName}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground font-mono">
                      {result.platform} • {result.modelId}
                    </p>
                  </div>
                </div>
                <DialogClose className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                  ✕
                </DialogClose>
              </div>

              {/* Status Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-card/60 border border-white/10 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                    Status
                  </div>
                  <div
                    className={`font-mono text-xs font-bold mt-0.5 ${
                      result.success ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {result.status} {result.success ? 'OK' : 'Error'}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-card/60 border border-white/10 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                    Latency
                  </div>
                  <div className="font-mono text-xs font-bold text-cyan-400 mt-0.5">
                    {result.latencyMs > 0 ? `${result.latencyMs} ms` : '—'}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-card/60 border border-white/10 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                    Active Key
                  </div>
                  <div className="font-mono text-xs font-bold text-purple-400 mt-0.5 truncate">
                    {result.keyLabel || `${result.keyCount ?? 0} Keys`}
                  </div>
                </div>
              </div>

              {/* Response or Error Body */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground">
                  {result.success ? 'Upstream Live Response:' : 'Upstream Error Details:'}
                </label>
                <div
                  className={`p-3 rounded-xl border font-mono text-xs leading-relaxed max-h-48 overflow-y-auto ${
                    result.success
                      ? 'bg-slate-950/80 border-emerald-500/20 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/20 text-rose-300'
                  }`}
                >
                  {result.success ? (
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1">
                        Prompt: &ldquo;Say &apos;ApiDoct OK&apos; in 3 words.&rdquo;
                      </div>
                      <div className="text-foreground font-semibold">&ldquo;{result.content}&rdquo;</div>
                    </div>
                  ) : (
                    <div>{result.error}</div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-2">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {new Date(result.timestamp).toLocaleTimeString()}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => handleTest(e)}
                    className="text-xs h-8 border-indigo-500/30 text-indigo-300"
                  >
                    <RefreshCw className="size-3 mr-1" />
                    Re-test
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowModal(false)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-4"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </DialogPopup>
        </Dialog>
      )}
    </>
  )
}
