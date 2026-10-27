import { NavLink, useLocation } from 'react-router-dom'
import {
  Network,
  KeyRound,
  Laptop,
  Activity,
  Cpu,
} from 'lucide-react'

export function MobileBottomNav({ onOpenRemote }: { onOpenRemote: () => void }) {
  const location = useLocation()

  const navItemClass = (isActive: boolean) =>
    `flex flex-col items-center justify-center flex-1 py-1.5 transition-all text-[10px] font-bold ${
      isActive
        ? 'text-indigo-400 scale-105'
        : 'text-muted-foreground hover:text-foreground'
    }`

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-card/85 backdrop-blur-2xl border-t border-white/10 shadow-2xl safe-area-pb">
      <div className="flex items-center justify-around h-14 px-2 max-w-lg mx-auto">
        <NavLink
          to="/playground"
          className={({ isActive }) => navItemClass(isActive)}
        >
          <Cpu className="size-5 mb-0.5 text-cyan-400" />
          <span>Playground</span>
        </NavLink>

        <NavLink
          to="/models/chat"
          className={() =>
            navItemClass(
              location.pathname.startsWith('/models') || location.pathname === '/'
            )
          }
        >
          <Network className="size-5 mb-0.5 text-indigo-400" />
          <span>Router</span>
        </NavLink>

        <NavLink
          to="/keys"
          className={({ isActive }) => navItemClass(isActive)}
        >
          <KeyRound className="size-5 mb-0.5 text-purple-400" />
          <span>Keys</span>
        </NavLink>

        <button
          type="button"
          onClick={onOpenRemote}
          className="flex flex-col items-center justify-center flex-1 py-1.5 transition-all text-[10px] font-bold text-muted-foreground hover:text-cyan-400"
        >
          <Laptop className="size-5 mb-0.5 text-amber-400" />
          <span>Remote PC</span>
        </button>

        <NavLink
          to="/analytics"
          className={({ isActive }) => navItemClass(isActive)}
        >
          <Activity className="size-5 mb-0.5 text-emerald-400" />
          <span>Telemetry</span>
        </NavLink>
      </div>
    </nav>
  )
}
