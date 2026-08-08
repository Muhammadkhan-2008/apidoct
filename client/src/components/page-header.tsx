import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions,
  divider = true,
}: {
  title: string
  description?: string
  actions?: ReactNode
  divider?: boolean
}) {
  return (
    <div className={`flex flex-wrap md:flex-nowrap items-center justify-between gap-6 mb-8 ${divider ? 'pb-6 border-b border-border/40' : ''}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">ApiDoct Gateway</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1.5 font-normal max-w-3xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0 bg-card/40 p-1.5 rounded-xl border border-border/30 backdrop-blur-md shadow-xs">{actions}</div>}
    </div>
  )
}
