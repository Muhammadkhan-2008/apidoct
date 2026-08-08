import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { PageHeader } from '@/components/page-header'
import type { ApiKey } from '../../../shared/types'
import { Plus, Download } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { HealthData } from '@/components/keys/shared'
import { QuotaSignalsSection } from '@/components/keys/quota-signals-section'
import { UnifiedKeySection } from '@/components/keys/unified-key-section'
import { ProxySettingsSection } from '@/components/keys/proxy-settings-section'
import { AnthropicSection } from '@/components/keys/anthropic-section'
import { ProviderList } from '@/components/keys/provider-list'
import { AddKeyDialog } from '@/components/keys/add-key-dialog'
import { ExportKeysDialog } from '@/components/keys/export-keys-dialog'
import { AgentCompatibilitySection } from '@/components/keys/agent-compatibility-section'

type KeysTab = 'providers' | 'quotaSignals' | 'apiKey' | 'anthropic' | 'agents'
const KEYS_TABS: { id: KeysTab; labelKey: string }[] = [
  { id: 'providers', labelKey: 'keys.tabProviders' },
  { id: 'quotaSignals', labelKey: 'keys.tabQuotaSignals' },
  { id: 'apiKey', labelKey: 'keys.tabApiKey' },
  { id: 'anthropic', labelKey: 'keys.tabAnthropic' },
  { id: 'agents', labelKey: 'keys.tabAgents' },
]

export default function KeysPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<KeysTab>('providers')
  const [addOpen, setAddOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  // Kept at page level for the header's "Check all" gate; ProviderList runs the
  // same query (deduped by react-query) for the list itself.
  const { data: keys = [] } = useQuery<ApiKey[]>({
    queryKey: ['keys'],
    queryFn: () => apiFetch('/api/keys'),
  })

  const { data: healthData } = useQuery<HealthData>({
    queryKey: ['health'],
    queryFn: () => apiFetch('/api/health'),
    refetchInterval: 30000,
  })

  const checkAll = useMutation({
    mutationFn: () => apiFetch('/api/health/check-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['keys'] })
    },
  })

  return (
    <div>
      <PageHeader
        title={t('keys.pageTitle')}
        description={t('keys.pageDescription')}
      />

      <div className="glass-card p-3 rounded-2xl border border-border/50 bg-card/70 backdrop-blur-md shadow-xs flex flex-wrap items-center justify-between gap-4 mb-8">
        <SegmentedControl
          value={tab}
          onValueChange={setTab}
          options={KEYS_TABS.map(tb => ({ value: tb.id, label: t(tb.labelKey) }))}
          ariaLabel={t('keys.pageTitle')}
        />

        <div className="flex items-center gap-2">
          {(tab === 'providers' || tab === 'quotaSignals') && keys.length > 0 && (
            <Button variant="outline" size="sm" className="rounded-xl border-border/40 hover:bg-accent" onClick={() => checkAll.mutate()} disabled={checkAll.isPending}>
              {checkAll.isPending ? t('keys.checking') : t('keys.checkAll')}
            </Button>
          )}
          {keys.length > 0 && (
            <Button variant="outline" size="sm" className="rounded-xl border-border/40 hover:bg-accent" onClick={() => setExportOpen(true)}>
              <Download className="size-3.5" />
              {t('keys.export')}
            </Button>
          )}
          {tab === 'providers' && (
            <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm transition-all" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" />
              {t('keys.addKey')}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {tab === 'apiKey' && (
          <>
            <UnifiedKeySection />
            <ProxySettingsSection />
          </>
        )}

        {tab === 'anthropic' && <AnthropicSection />}
        {tab === 'agents' && <AgentCompatibilitySection />}

        {tab === 'quotaSignals' && (
          <QuotaSignalsSection states={(healthData?.quotaStates ?? []).slice(0, 24)} />
        )}

        {tab === 'providers' && <ProviderList onAddKey={() => setAddOpen(true)} />}
      </div>

      <AddKeyDialog open={addOpen} onOpenChange={setAddOpen} />
      {exportOpen && <ExportKeysDialog open={exportOpen} onOpenChange={setExportOpen} />}
    </div>
  )
}
