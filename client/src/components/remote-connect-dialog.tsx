import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Laptop,
  Wifi,
  Usb,
  Cloud,
  Copy,
  Check,
  Globe,
  ShieldCheck,
  Download,
  Upload,
  X,
} from 'lucide-react'
import { Dialog, DialogClose, DialogPopup, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiFetch, getServerUrl, setServerUrl } from '@/lib/api'
import { toast } from '@/lib/toast'
import { QRCode } from '@/components/qr-code'

interface RemoteInfo {
  success: boolean
  port: number
  primaryLanUrl: string
  lanUrls: string[]
  localhostUrl: string
  adbReverseCommand: string
  keysCount: number
  userEmail: string | null
  serverRunning: boolean
}

export function RemoteConnectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'wifi' | 'usb' | 'vault' | 'target'>('wifi')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedAdb, setCopiedAdb] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [customServerInput, setCustomServerInput] = useState(() => getServerUrl())
  const [syncTokenInput, setSyncTokenInput] = useState('')

  const { data: remoteInfo } = useQuery<RemoteInfo>({
    queryKey: ['remote-info'],
    queryFn: () => apiFetch('/api/remote/info'),
    enabled: open,
  })

  const { data: vaultStatus, refetch: refetchVault } = useQuery<{ success: boolean; exists: boolean; keyCount?: number; updatedAt?: string }>({
    queryKey: ['cloud-vault-status'],
    queryFn: () => apiFetch('/api/sync/vault'),
    enabled: open,
  })

  const backupMutation = useMutation({
    mutationFn: () => apiFetch('/api/sync/vault/backup', { method: 'POST' }),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Backed up keys to Cloud Vault!')
      refetchVault()
    },
    onError: (err: any) => toast.error(err.message || 'Backup failed'),
  })

  const restoreMutation = useMutation({
    mutationFn: () => apiFetch('/api/sync/vault/restore', { method: 'POST' }),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Keys restored from Cloud Vault!')
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
      refetchVault()
    },
    onError: (err: any) => toast.error(err.message || 'Restore failed'),
  })

  const exportTokenMutation = useMutation({
    mutationFn: () => apiFetch<{ success: boolean; token: string }>('/api/sync/export-token', { method: 'POST' }),
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.token)
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 3000)
      toast.success('Sync Token copied to clipboard!')
    },
  })

  const importTokenMutation = useMutation({
    mutationFn: (token: string) => apiFetch('/api/sync/import-token', { method: 'POST', body: JSON.stringify({ token }) }),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Sync token imported successfully!')
      setSyncTokenInput('')
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
    },
    onError: (err: any) => toast.error(err.message || 'Failed to import token'),
  })

  const primaryUrl = remoteInfo?.primaryLanUrl || 'http://192.168.52.202:3001'
  const adbCmd = remoteInfo?.adbReverseCommand || 'adb reverse tcp:3001 tcp:3001'

  const copyToClipboard = (text: string, isAdb = false) => {
    navigator.clipboard.writeText(text)
    if (isAdb) {
      setCopiedAdb(true)
      setTimeout(() => setCopiedAdb(false), 2000)
    } else {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    }
    toast.success('Copied to clipboard!')
  }

  const handleSaveCustomServer = () => {
    setServerUrl(customServerInput)
    toast.success(`Server target updated to: ${customServerInput || 'Default Local'}`)
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup maxWidth="max-w-xl">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 text-cyan-400 border border-cyan-500/30">
              <Laptop className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-extrabold tracking-tight">
                Connect PC & Remote Devices
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Run server on Mobile (Termux) & use from PC, Laptop, or Tablet
              </p>
            </div>
          </div>
          <DialogClose className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </DialogClose>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-4 gap-1 p-1 my-4 rounded-2xl bg-accent/20 border border-border/40 text-xs font-bold">
          <button
            onClick={() => setActiveTab('wifi')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
              activeTab === 'wifi'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wifi className="size-3.5" />
            <span>Wi-Fi / LAN</span>
          </button>

          <button
            onClick={() => setActiveTab('usb')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
              activeTab === 'usb'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Usb className="size-3.5" />
            <span>USB (ADB)</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
              activeTab === 'vault'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Cloud className="size-3.5" />
            <span>Cloud Vault</span>
          </button>

          <button
            onClick={() => setActiveTab('target')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
              activeTab === 'target'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe className="size-3.5" />
            <span>Target IP</span>
          </button>
        </div>

        {/* TAB 1: WI-FI / HOTSPOT CONNECT */}
        {activeTab === 'wifi' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-card/60 border border-indigo-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Mobile Server Address (Wi-Fi / Hotspot)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-accent text-foreground">
                  Port {remoteInfo?.port || 3001}
                </span>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-white/10 font-mono text-xs text-cyan-300">
                <span className="flex-1 truncate">{primaryUrl}</span>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(primaryUrl)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1 h-7 rounded-lg"
                >
                  {copiedUrl ? <Check className="size-3.5 mr-1" /> : <Copy className="size-3.5 mr-1" />}
                  {copiedUrl ? 'Copied!' : 'Copy'}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect your PC or laptop to the <strong className="text-foreground">same Wi-Fi or mobile hotspot</strong>, then open the URL above in Chrome, Edge, or Firefox. You will immediately access this mobile server with all your API keys!
              </p>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center pt-2">
              <QRCode text={primaryUrl} size={150} />
            </div>
          </div>
        )}

        {/* TAB 2: USB CONNECT (ADB REVERSE) */}
        {activeTab === 'usb' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-card/60 border border-purple-500/20 space-y-3">
              <h4 className="text-xs font-bold text-purple-400 flex items-center gap-2">
                <Usb className="size-4" />
                Zero-Latency USB Tethering / ADB
              </h4>
              <p className="text-xs text-muted-foreground">
                If you connect your phone to your PC via USB cable, you can forward port 3001 so you can simply type <code className="text-cyan-300 font-mono">http://localhost:3001</code> on your PC!
              </p>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground">Run on PC Terminal / CMD:</label>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-white/10 font-mono text-xs text-purple-300">
                  <span className="flex-1 truncate">{adbCmd}</span>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(adbCmd, true)}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-1 h-7 rounded-lg"
                  >
                    {copiedAdb ? <Check className="size-3.5 mr-1" /> : <Copy className="size-3.5 mr-1" />}
                    {copiedAdb ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-accent/20 border border-border/30 text-xs space-y-1">
                <div className="font-bold text-foreground">Next Step on PC:</div>
                <div className="text-muted-foreground">
                  Open <span className="text-cyan-400 font-mono font-bold">http://localhost:3001</span> in PC Chrome — you will see your exact mobile server!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CLOUD VAULT SYNC */}
        {activeTab === 'vault' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-card/60 border border-cyan-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-2">
                  <Cloud className="size-4" />
                  Email Cloud Vault Sync
                </h4>
                {vaultStatus?.exists && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="size-3" /> {vaultStatus.keyCount} Keys Synced
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                When you log in with your email on any other phone or PC, your API keys automatically sync. You can also manually push or pull your keys right now:
              </p>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  onClick={() => backupMutation.mutate()}
                  disabled={backupMutation.isPending}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs h-9 rounded-xl"
                >
                  <Upload className="size-3.5 mr-1.5" />
                  {backupMutation.isPending ? 'Backing up...' : 'Backup Keys to Vault'}
                </Button>

                <Button
                  onClick={() => restoreMutation.mutate()}
                  disabled={restoreMutation.isPending}
                  variant="outline"
                  className="border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 font-bold text-xs h-9 rounded-xl"
                >
                  <Download className="size-3.5 mr-1.5" />
                  {restoreMutation.isPending ? 'Restoring...' : 'Restore to this Device'}
                </Button>
              </div>
            </div>

            {/* 1-Click Sync Token */}
            <div className="p-4 rounded-2xl bg-card/40 border border-white/10 space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Portable 1-Click Sync Token</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportTokenMutation.mutate()}
                  disabled={exportTokenMutation.isPending}
                  className="text-xs h-7 rounded-lg border-indigo-500/40 text-indigo-400"
                >
                  <Copy className="size-3 mr-1" />
                  {copiedToken ? 'Token Copied!' : 'Copy Sync Token'}
                </Button>
              </h4>
              <p className="text-xs text-muted-foreground">
                Paste a sync token generated from another device to instantly import all keys without passwords:
              </p>
              <div className="flex gap-2">
                <Input
                  value={syncTokenInput}
                  onChange={(e) => setSyncTokenInput(e.target.value)}
                  placeholder="Paste apidoct-sync:v1:... token here"
                  className="text-xs font-mono h-8"
                />
                <Button
                  size="sm"
                  onClick={() => importTokenMutation.mutate(syncTokenInput)}
                  disabled={!syncTokenInput || importTokenMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3 rounded-lg"
                >
                  Import
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SET TARGET SERVER IP (FOR PC) */}
        {activeTab === 'target' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-card/60 border border-amber-500/20 space-y-3">
              <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2">
                <Globe className="size-4" />
                Set Mobile Server Address (On PC Browser)
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If you are running the frontend on PC and want to connect it to your Android phone running in Termux, enter your phone's IP address below:
              </p>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-muted-foreground">Mobile Server Address:</label>
                <div className="flex gap-2">
                  <Input
                    value={customServerInput}
                    onChange={(e) => setCustomServerInput(e.target.value)}
                    placeholder="http://192.168.52.202:3001"
                    className="font-mono text-xs h-9"
                  />
                  <Button
                    onClick={handleSaveCustomServer}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md"
                  >
                    Save & Connect
                  </Button>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center text-xs text-muted-foreground">
                <span>Current Target:</span>
                <span className="font-mono text-foreground font-bold">{getServerUrl() || 'Same Origin (Local)'}</span>
              </div>
            </div>
          </div>
        )}
      </DialogPopup>
    </Dialog>
  )
}
