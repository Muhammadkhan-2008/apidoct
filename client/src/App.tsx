import { useState, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KeyRound, LogOut, Menu, MoreHorizontal, Search, Settings, Sparkles, Activity, Cpu, Layers, MessageSquare, Dna, Image as ImageIcon, Mic, Network, Lock, BarChart3, Award, BookOpen } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AuthGate, ChangeCredentialsModal } from '@/components/auth-gate'
import { CommandPalette } from '@/components/command-palette'
import { openCommandPalette } from '@/components/command-palette-state'
import { ErrorBoundary } from '@/components/error-boundary'
import { SettingsDialog } from '@/components/settings-dialog'
import { Toaster } from '@/components/toaster'
import { usePremium } from '@/hooks/use-premium'
import { I18nProvider, useI18n } from '@/i18n'
import { logout } from '@/lib/api'
import { toast } from '@/lib/toast'
import { ThemeProvider } from '@/theme'
import KeysPage from '@/pages/KeysPage'
import PlaygroundPage from '@/pages/PlaygroundPage'
import FallbackPage from '@/pages/FallbackPage'
import ModelDetailPage from '@/pages/ModelDetailPage'
import FusionPage from '@/pages/FusionPage'
import EmbeddingsPage from '@/pages/EmbeddingsPage'
import ImagePage from '@/pages/ImagePage'
import AudioPage from '@/pages/AudioPage'
import MediaDetailPage from '@/pages/MediaDetailPage'
import EmbeddingDetailPage from '@/pages/EmbeddingDetailPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import PremiumPage from '@/pages/PremiumPage'
import NotFoundPage from '@/pages/NotFoundPage'
import AgentsPage from '@/pages/AgentsPage'

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.silenceToast) return
      toast.error(error instanceof Error ? error.message : String(error))
    },
  }),
})

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

// Vibrant 10-Spectrum Spectrum Logo with Glow Multi-Color Accent
function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3 transition-all duration-300 hover:opacity-95 group">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 via-amber-400 via-emerald-400 via-cyan-400 to-indigo-600 text-white font-black text-lg shadow-2xl transition-transform duration-300 group-hover:scale-105 p-0.5">
        <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950/90 text-white font-black">
          <span className="bg-gradient-to-r from-rose-400 via-amber-300 via-emerald-300 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
            A
          </span>
        </div>
      </div>
      <div className="flex flex-col">
        <span className="font-black tracking-tight text-xl bg-gradient-to-r from-indigo-400 via-purple-300 via-cyan-300 to-emerald-400 bg-clip-text text-transparent leading-none">
          ApiDoct
        </span>
        <span className="text-[9px] text-amber-400 font-mono mt-1 tracking-widest uppercase font-bold">
          Universal Gateway
        </span>
      </div>
    </Link>
  )
}

const isDesktopApp = typeof window !== 'undefined'
  && (window as Window & { __FREEAPI_DESKTOP__?: boolean }).__FREEAPI_DESKTOP__ === true

if (isDesktopApp) {
  document.documentElement.classList.add('desktop')
}

function AccountMenuItems({
  showUpgrade,
  upgradeLabel,
  settingsLabel,
  signOutLabel,
  changeEmailLabel,
  changePasswordLabel,
  onUpgrade,
  onOpenSettings,
  onChangeEmail,
  onChangePassword,
}: {
  showUpgrade: boolean
  upgradeLabel: string
  settingsLabel: string
  signOutLabel: string
  changeEmailLabel: string
  changePasswordLabel: string
  onUpgrade: () => void
  onOpenSettings: () => void
  onChangeEmail: () => void
  onChangePassword: () => void
}) {
  return (
    <>
      {showUpgrade && (
        <DropdownMenuItem onClick={onUpgrade} className="cursor-pointer font-bold text-amber-400 focus:text-amber-300">
          <Sparkles className="size-4 mr-2" />
          {upgradeLabel}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={onOpenSettings} className="cursor-pointer font-medium text-foreground">
        <Settings className="size-4 mr-2 text-indigo-400" />
        {settingsLabel}
      </DropdownMenuItem>
      {!isDesktopApp && (
        <>
          <DropdownMenuSeparator className="bg-border/40" />
          <DropdownMenuItem onClick={onChangeEmail} className="cursor-pointer text-xs font-medium">
            <span className="flex size-4 items-center justify-center font-serif text-xs font-bold text-cyan-400 mr-2">@</span>
            {changeEmailLabel}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onChangePassword} className="cursor-pointer text-xs font-medium">
            <KeyRound className="size-4 mr-2 text-purple-400" />
            {changePasswordLabel}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => logout()} className="cursor-pointer text-xs font-semibold text-rose-400 focus:text-rose-300">
            <LogOut className="size-4 mr-2" />
            {signOutLabel}
          </DropdownMenuItem>
        </>
      )}
    </>
  )
}

function SidebarNav() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [credentialsMode, setCredentialsMode] = useState<'password' | 'email' | null>(null)
  const { data: premium, licensed, isLoading: premiumLoading, isError: premiumError } = usePremium()
  const showUpgrade = Boolean(premium) && !licensed && !premiumLoading && !premiumError

  return (
    <>
      <aside className="w-72 shrink-0 border-r border-white/10 glass-card hidden md:flex flex-col h-screen sticky top-0 z-30 shadow-2xl bg-card/60 backdrop-blur-2xl">
        <div className="h-20 px-6 border-b border-border/40 flex items-center justify-between bg-card/40">
          <Brand />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 custom-scrollbar">
          {/* Section 1: INFERENCE ENGINES */}
          <div>
            <div className="flex items-center gap-2 px-3 mb-3">
              <Layers className="size-3.5 text-indigo-400" />
              <p className="text-[10px] font-black text-indigo-400/90 uppercase tracking-widest">INFERENCE ENGINES</p>
            </div>
            <div className="space-y-1.5">
              <NavLink
                to="/models/chat"
                className={() =>
                  `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
                    location.pathname.startsWith('/models/chat') || location.pathname === '/' || location.pathname === '/models'
                      ? 'bg-gradient-to-r from-indigo-600/30 via-purple-600/20 to-transparent text-indigo-300 border border-indigo-500/40 glow-indigo shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-indigo-500/15 hover:to-transparent border border-transparent'
                  }`
                }
              >
                <MessageSquare className="size-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>Chat & Reasoning</span>
              </NavLink>

              <NavLink
                to="/models/embeddings"
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-600/30 via-indigo-600/20 to-transparent text-cyan-300 border border-cyan-500/40 glow-cyan shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-cyan-500/15 hover:to-transparent border border-transparent'
                  }`
                }
              >
                <Dna className="size-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>Vector Embeddings</span>
              </NavLink>

              <NavLink
                to="/models/image"
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600/30 via-pink-600/20 to-transparent text-purple-300 border border-purple-500/40 glow-indigo shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-purple-500/15 hover:to-transparent border border-transparent'
                  }`
                }
              >
                <ImageIcon className="size-4 text-purple-400 group-hover:scale-110 transition-transform" />
                <span>Visual Media</span>
              </NavLink>

              <NavLink
                to="/models/audio"
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600/30 via-teal-600/20 to-transparent text-emerald-300 border border-emerald-500/40 glow-emerald shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-emerald-500/15 hover:to-transparent border border-transparent'
                  }`
                }
              >
                <Mic className="size-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Audio & Speech</span>
              </NavLink>

              <NavLink
                to="/models/fusion"
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-600/30 via-orange-600/20 to-transparent text-amber-300 border border-amber-500/40 shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-amber-500/15 hover:to-transparent border border-transparent'
                  }`
                }
              >
                <Network className="size-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Smart Router Fusion</span>
              </NavLink>
            </div>
          </div>

          {/* Section 2: KEYS & TESTING */}
          <div>
            <div className="flex items-center gap-2 px-3 mb-3">
              <Lock className="size-3.5 text-cyan-400" />
              <p className="text-[10px] font-black text-cyan-400/90 uppercase tracking-widest">KEYS & TESTING</p>
            </div>
            <div className="space-y-1.5">
              <NavLink
                to="/playground"
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-600/30 via-indigo-600/20 to-transparent text-cyan-300 border border-cyan-500/40 glow-cyan shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-cyan-500/15 hover:to-transparent border border-transparent'
                  }`
                }
              >
                <Cpu className="size-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>AI Playground</span>
              </NavLink>

              <NavLink
                to="/keys"
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600/30 via-indigo-600/20 to-transparent text-purple-300 border border-purple-500/40 glow-indigo shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-purple-500/15 hover:to-transparent border border-transparent'
                  }`
                }
              >
                <KeyRound className="size-4 text-purple-400 group-hover:scale-110 transition-transform" />
                <span>Provider Keys</span>
              </NavLink>

              <NavLink
                to="/agents"
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600/30 via-purple-600/20 to-transparent text-indigo-300 border border-indigo-500/40 glow-indigo shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-indigo-500/15 hover:to-transparent border border-transparent'
                  }`
                }
              >
                <BookOpen className="size-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>ApiDoct Docs</span>
              </NavLink>
            </div>
          </div>

          {/* Section 3: ANALYTICS & PRO */}
          <div>
            <div className="flex items-center gap-2 px-3 mb-3">
              <BarChart3 className="size-3.5 text-emerald-400" />
              <p className="text-[10px] font-black text-emerald-400/90 uppercase tracking-widest">ANALYTICS & PRO</p>
            </div>
            <div className="space-y-1.5">
              <NavLink
                to="/analytics"
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600/30 via-teal-600/20 to-transparent text-emerald-300 border border-emerald-500/40 glow-emerald shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-emerald-500/15 hover:to-transparent border border-transparent'
                  }`
                }
              >
                <Activity className="size-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Telemetry Analytics</span>
              </NavLink>

              <NavLink
                to="/premium"
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-600/30 via-rose-600/20 to-transparent text-amber-300 border border-amber-500/40 shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-amber-500/15 hover:to-transparent border border-transparent'
                  }`
                }
              >
                <Award className="size-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>ApiDoct Pro</span>
              </NavLink>
            </div>
          </div>
        </div>

        {/* Footer Account Card */}
        <div className="p-4 border-t border-border/40 bg-card/60">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center justify-between w-full p-3 rounded-2xl bg-card/80 border border-white/10 text-xs font-bold hover:bg-accent/50 transition-all shadow-lg hover:border-indigo-500/40">
              <span className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-md"></span>
                </span>
                <span className="font-extrabold text-foreground tracking-tight">ApiDoct Security Active</span>
              </span>
              <MoreHorizontal className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 glass-card p-2 shadow-2xl border-white/10">
              <AccountMenuItems
                showUpgrade={showUpgrade}
                upgradeLabel={t('nav.upgrade')}
                settingsLabel={t('nav.settings')}
                signOutLabel={t('nav.signOut')}
                changeEmailLabel={t('auth.changeEmail')}
                changePasswordLabel={t('auth.changePassword')}
                onUpgrade={() => navigate('/premium')}
                onOpenSettings={() => setSettingsOpen(true)}
                onChangeEmail={() => setCredentialsMode('email')}
                onChangePassword={() => setCredentialsMode('password')}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      {credentialsMode && (
        <ChangeCredentialsModal mode={credentialsMode} onClose={() => setCredentialsMode(null)} />
      )}
    </>
  )
}

function TopHeader() {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <header className="h-20 border-b border-white/10 glass-card px-6 flex items-center justify-between sticky top-0 z-20 shadow-xl bg-card/60 backdrop-blur-2xl">
      <div className="flex items-center gap-4">
        <div className="md:hidden">
          <Brand />
        </div>
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label={t('palette.title')}
          className="flex items-center gap-3.5 px-4 py-2 rounded-2xl border border-white/10 bg-card/50 text-xs text-muted-foreground hover:border-indigo-500/50 hover:text-foreground hover:shadow-lg transition-all duration-300 glow-indigo"
        >
          <Search className="size-4 text-indigo-400" />
          <span className="font-medium">Search ApiDoct models, key vault or configs...</span>
          <kbd className="px-2 py-0.5 rounded-lg bg-accent text-[10px] font-mono font-black text-indigo-400 border border-border/40 shadow-xs">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-300 border border-emerald-500/30 shadow-md">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          ⚡ ApiDoct Engine Online
        </span>

        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: 'ghost', size: 'icon' })}
              aria-label={t('nav.openMenu')}
            >
              <Menu />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 glass-card p-2 shadow-2xl">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => navigate('/models/chat')} className="font-bold text-indigo-400">
                  <MessageSquare className="size-4 mr-2" /> Chat & Reasoning
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/models/embeddings')} className="font-bold text-cyan-400">
                  <Dna className="size-4 mr-2" /> Vector Embeddings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/playground')} className="font-bold text-purple-400">
                  <Cpu className="size-4 mr-2" /> Testing Lab
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/keys')} className="font-bold text-indigo-400">
                  <KeyRound className="size-4 mr-2" /> Provider Keys
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/analytics')} className="font-bold text-emerald-400">
                  <BarChart3 className="size-4 mr-2" /> Telemetry Analytics
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

function PageBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <AuthGate>
              <div className={`min-h-screen flex ${isDesktopApp ? 'desktop-backdrop' : 'bg-background'}`}>
                <SidebarNav />
                <div className="flex-1 flex flex-col min-w-0">
                  <TopHeader />
                  <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
                    <PageBoundary>
                      <Routes>
                        <Route path="/" element={<Navigate to="/models/chat" replace />} />
                        <Route path="/models" element={<Navigate to="/models/chat" replace />} />
                        <Route path="/models/chat" element={<FallbackPage />} />
                        <Route path="/models/chat/:id" element={<ModelDetailPage />} />
                        <Route path="/models/fusion" element={<FusionPage />} />
                        <Route path="/models/embeddings" element={<EmbeddingsPage />} />
                        <Route path="/models/embeddings/:id" element={<EmbeddingDetailPage />} />
                        <Route path="/models/image" element={<ImagePage />} />
                        <Route path="/models/image/:id" element={<MediaDetailPage modality="image" />} />
                        <Route path="/models/audio" element={<AudioPage />} />
                        <Route path="/models/audio/:id" element={<MediaDetailPage modality="audio" />} />
                        <Route path="/models/transcription/:id" element={<MediaDetailPage modality="transcription" />} />
                        <Route path="/playground" element={<PlaygroundPage />} />
                        <Route path="/keys" element={<KeysPage />} />
                        <Route path="/agents" element={<AgentsPage />} />
                        <Route path="/fallback" element={<Navigate to="/models/chat" replace />} />
                        <Route path="/analytics" element={<AnalyticsPage />} />
                        <Route path="/premium" element={<PremiumPage />} />
                        <Route path="/test" element={<Navigate to="/playground" replace />} />
                        <Route path="/health" element={<Navigate to="/keys" replace />} />
                        <Route path="*" element={<NotFoundPage />} />
                      </Routes>
                    </PageBoundary>
                  </main>
                </div>
                <Toaster />
                <CommandPalette />
              </div>
            </AuthGate>
          </BrowserRouter>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
