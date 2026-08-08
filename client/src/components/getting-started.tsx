import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check, Copy, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { copyText } from '@/lib/clipboard'
import { toast } from '@/lib/toast'
import { apiBaseUrl } from '@/components/api-usage'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

const DISMISS_KEY = 'apidoct.setup.dismissed'
const CONNECT_KEY = 'apidoct.setup.connected'

function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}
function writeFlag(key: string) {
  try { localStorage.setItem(key, '1') } catch { /* ignore */ }
}

// First-run checklist on the Models landing page. A fresh install lands on an
// empty routing table with no hint of what to do; this walks the three steps
// that make the router actually useful (key -> test -> connect) and disappears
// once the install is clearly set up (has keys and has served a request), or
// when dismissed.
export function GettingStarted() {
  const { t } = useI18n()
  const [dismissed, setDismissed] = useState(() => readFlag(DISMISS_KEY))
  const [connected, setConnected] = useState(() => readFlag(CONNECT_KEY))

  const { data: keys } = useQuery<unknown[]>({
    queryKey: ['keys'],
    queryFn: () => apiFetch('/api/keys'),
  })
  const { data: summary } = useQuery<{ totalRequests?: number }>({
    queryKey: ['setup-summary'],
    queryFn: () => apiFetch('/api/analytics/summary?range=30d'),
    staleTime: 30_000,
  })
  const { data: keyData } = useQuery<{ apiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  // Wait for real data before deciding: rendering on undefined would flash the
  // checklist at every established install for a moment on each visit.
  if (dismissed || !keys || !summary) return null

  const hasKeys = keys.length > 0
  const hasRequest = (summary.totalRequests ?? 0) > 0
  if (hasKeys && hasRequest) return null

  const doneCount = [hasKeys, hasRequest, connected].filter(Boolean).length

  function copyValue(value: string, message: string) {
    void copyText(value).then(ok => {
      if (!ok) {
        toast.error(t('common.copyFailed'))
        return
      }
      toast.success(message)
      setConnected(true)
      writeFlag(CONNECT_KEY)
    })
  }

  return (
    <section className="glass-card rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-card/80 via-card/50 to-emerald-500/5 p-6 backdrop-blur-md shadow-xs transition-all">
      <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-foreground">{t('setup.title')}</h2>
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              ApiDoct Quickstart
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t('setup.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-accent/50 px-3 py-1 text-xs font-medium tabular-nums text-foreground border border-border/40">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {t('setup.progress', { done: doneCount, total: 3 })}
          </div>
          <button
            type="button"
            aria-label={t('common.dismiss')}
            onClick={() => { setDismissed(true); writeFlag(DISMISS_KEY) }}
            className="rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <ol className="mt-4 space-y-2">
        <Step
          index={1}
          done={hasKeys}
          title={t('setup.step1Title')}
          description={t('setup.step1Desc')}
          action={
            <Link to="/keys">
              <Button variant="outline" size="sm" className="rounded-lg border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-500 transition-all">
                {t('setup.step1Cta')}
                <ArrowRight data-icon="inline-end" className="size-3.5" />
              </Button>
            </Link>
          }
        />
        <Step
          index={2}
          done={hasRequest}
          title={t('setup.step2Title')}
          description={t('setup.step2Desc')}
          action={
            <Link to="/playground">
              <Button variant="outline" size="sm" className="rounded-lg border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-500 transition-all">
                {t('setup.step2Cta')}
                <ArrowRight data-icon="inline-end" className="size-3.5" />
              </Button>
            </Link>
          }
        />
        <Step
          index={3}
          done={connected}
          title={t('setup.step3Title')}
          description={t('setup.step3Desc')}
          action={
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg border-emerald-500/30 hover:bg-emerald-500/10 transition-all"
                disabled={!keyData?.apiKey}
                onClick={() => keyData?.apiKey && copyValue(keyData.apiKey, t('setup.copiedKey'))}
              >
                <Copy data-icon="inline-start" className="size-3.5" />
                {t('setup.copyKey')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg border-emerald-500/30 hover:bg-emerald-500/10 transition-all"
                onClick={() => copyValue(apiBaseUrl(), t('setup.copiedUrl'))}
              >
                <Copy data-icon="inline-start" className="size-3.5" />
                {t('setup.copyUrl')}
              </Button>
            </div>
          }
        />
      </ol>
    </section>
  )
}

function Step({
  index,
  done,
  title,
  description,
  action,
}: {
  index: number
  done: boolean
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-2 py-2.5 sm:flex-nowrap">
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium tabular-nums ${
          done ? 'bg-emerald-600 text-white dark:bg-emerald-500' : 'border text-muted-foreground'
        }`}
      >
        {done ? <Check className="size-3" /> : index}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${done ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'font-medium'}`}>{title}</p>
        {!done && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {!done && <div className="ml-8 shrink-0 sm:ml-0">{action}</div>}
    </li>
  )
}
