import { memo, isValidElement, useState, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Copy,
  Check,
  Play,
  ExternalLink,
  RotateCw,
  X,
  Monitor,
  Tablet,
  Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { copyText } from '@/lib/clipboard'

// Pull raw text recursively out of a React node tree
function nodeText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement(node)) return nodeText((node.props as { children?: ReactNode }).children)
  return ''
}

// Extract language and code string from <pre>'s children (which is a <code> element)
function getCodeMeta(children: ReactNode): { language: string; rawCode: string } {
  let language = ''
  if (isValidElement(children)) {
    const codeProps = children.props as { className?: string; children?: ReactNode }
    const match = /language-([a-zA-Z0-9_-]+)/.exec(codeProps.className || '')
    if (match) {
      language = match[1].toLowerCase()
    }
  }
  const rawCode = nodeText(children).replace(/\n$/, '')
  return { language, rawCode }
}

// Human-friendly language badge label
function formatLanguage(lang: string): string {
  if (!lang) return 'Code'
  const map: Record<string, string> = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    html: 'HTML',
    htm: 'HTML',
    xhtml: 'HTML',
    css: 'CSS',
    py: 'Python',
    python: 'Python',
    sh: 'Bash',
    bash: 'Bash',
    shell: 'Shell',
    zsh: 'Zsh',
    json: 'JSON',
    md: 'Markdown',
    markdown: 'Markdown',
    sql: 'SQL',
    rs: 'Rust',
    rust: 'Rust',
    go: 'Go',
    golang: 'Go',
    cpp: 'C++',
    c: 'C',
    java: 'Java',
    yaml: 'YAML',
    yml: 'YAML',
    xml: 'XML',
    svg: 'SVG',
  }
  return map[lang.toLowerCase()] || lang.toUpperCase()
}

// Detect if the code block is an HTML / web snippet eligible for live in-browser preview
function isHtmlSnippet(code: string, lang: string): boolean {
  const l = lang.toLowerCase()
  if (l === 'html' || l === 'htm' || l === 'xhtml' || l === 'svg') return true
  const lower = code.trim().toLowerCase()
  if (lower.startsWith('<!doctype html') || lower.startsWith('<html')) return true
  if (lower.includes('<body') && lower.includes('</body>')) return true
  if (
    lower.includes('<style') &&
    lower.includes('</style>') &&
    (lower.includes('<div') || lower.includes('<script'))
  ) {
    return true
  }
  return false
}

// Wrap incomplete HTML snippets with basic HTML5 doctype and viewport
function preparePreviewHtml(code: string): string {
  const trimmed = code.trim()
  const lower = trimmed.toLowerCase()
  if (lower.startsWith('<!doctype html') || lower.includes('<html')) {
    return trimmed
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ApiDoct Live Preview</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  ${trimmed}
</body>
</html>`
}

// Live In-Browser Web Preview Modal / Dialog
function HtmlPreviewModal({
  isOpen,
  onClose,
  code,
}: {
  isOpen: boolean
  onClose: () => void
  code: string
}) {
  const [device, setDevice] = useState<'full' | 'tablet' | 'mobile'>('full')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const htmlDoc = preparePreviewHtml(code)

  const handleOpenNewTab = () => {
    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  const modal = (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/85 backdrop-blur-md animate-fade-in">
      {/* Top Bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-zinc-900/95 px-3 sm:px-5 text-white">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-md">
            <Play className="size-4 fill-white text-white ml-0.5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold leading-tight flex items-center gap-2">
              <span>Live Web Preview</span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-mono">
                HTML5 / CSS / JS
              </span>
            </h3>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 font-mono">
              Executed in browser sandbox
            </p>
          </div>
        </div>

        {/* Viewport switcher */}
        <div className="hidden md:flex items-center rounded-xl border border-white/10 bg-zinc-800/80 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setDevice('full')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all',
              device === 'full' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white',
            )}
            title="Desktop 100% width"
          >
            <Monitor className="size-3.5" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setDevice('tablet')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all',
              device === 'tablet' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white',
            )}
            title="Tablet width (768px)"
          >
            <Tablet className="size-3.5" />
            <span>Tablet</span>
          </button>
          <button
            type="button"
            onClick={() => setDevice('mobile')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all',
              device === 'mobile' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white',
            )}
            title="Mobile width (375px)"
          >
            <Smartphone className="size-3.5" />
            <span>Mobile</span>
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            title="Re-run scripts"
          >
            <RotateCw className="size-3.5" />
            <span className="hidden sm:inline">Reload</span>
          </button>
          <button
            type="button"
            onClick={handleOpenNewTab}
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            title="Open preview in new browser tab"
          >
            <ExternalLink className="size-3.5" />
            <span className="hidden sm:inline">New Tab</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 hover:text-rose-100 transition-colors"
            title="Close preview (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 overflow-hidden p-2 sm:p-4 flex items-center justify-center bg-zinc-950/70">
        <div
          className={cn(
            'h-full transition-all duration-200 overflow-hidden rounded-xl sm:rounded-2xl bg-white shadow-2xl border border-zinc-700/60',
            device === 'full' && 'w-full',
            device === 'tablet' && 'w-[768px] max-w-full',
            device === 'mobile' && 'w-[375px] max-w-full',
          )}
        >
          <iframe
            key={reloadKey}
            srcDoc={htmlDoc}
            sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
            className="w-full h-full border-0 bg-white"
            title="Live Web Preview"
          />
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}

// ChatGPT / DeepSeek style Code Snippet Box with Header, Language Badge, Copy & HTML Preview
function CodeBlock({ children }: { children?: ReactNode }) {
  const { language, rawCode } = getCodeMeta(children)
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const isHtml = isHtmlSnippet(rawCode, language)
  const displayLang = formatLanguage(language)

  const handleCopy = () => {
    void copyText(rawCode).then((ok) => {
      if (ok) {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }
    })
  }

  return (
    <>
      <div className="my-3 overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-950/90 shadow-xl group first:mt-0 last:mb-0">
        {/* Code Header Bar */}
        <div className="flex items-center justify-between border-b border-zinc-800/90 bg-zinc-900/90 px-3.5 py-1.5 text-xs text-zinc-400 select-none">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
              {displayLang}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Live Web Preview Button */}
            {isHtml && (
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/25 hover:text-cyan-200 active:scale-95 shadow-xs"
                title="Preview HTML / CSS / JS in live browser sandbox"
              >
                <Play className="size-3 fill-current text-cyan-400" />
                <span>Preview</span>
              </button>
            )}

            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/70 bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white active:scale-95"
              title="Copy code to clipboard"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold text-[11px]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span className="text-[11px]">Copy code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code body */}
        <pre className="overflow-x-auto p-4 text-[12.5px] font-mono leading-relaxed text-zinc-100 custom-scrollbar select-text bg-[#0d1117] [&>code]:bg-transparent [&>code]:p-0 [&>code]:rounded-none [&>code]:font-mono">
          {children}
        </pre>
      </div>

      {/* Live Preview Modal */}
      {showPreview && (
        <HtmlPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          code={rawCode}
        />
      )}
    </>
  )
}

const components: Components = {
  p: ({ children }) => (
    <p className="my-2 first:mt-0 last:mb-0 whitespace-pre-wrap wrap-break-word">
      {children}
    </p>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="underline underline-offset-2 decoration-foreground/40 hover:decoration-foreground wrap-break-word"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-base font-semibold tracking-tight first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 text-sm font-semibold tracking-tight first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  ul: ({ children }) => (
    <ul className="my-2 ml-5 list-disc space-y-1 [&_ul]:my-1 [&_ol]:my-1 first:mt-0 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-5 list-decimal space-y-1 [&_ul]:my-1 [&_ol]:my-1 first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-foreground/20 pl-3 italic text-foreground/80 first:mt-0 last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-foreground/15" />,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="opacity-70">{children}</del>,

  table: ({ children }) => (
    <div className="my-2 overflow-x-auto first:mt-0 last:mb-0">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-background/40">{children}</thead>,
  th: ({ children, style }) => (
    <th
      style={style}
      className="border border-foreground/15 px-2 py-1 text-left font-semibold"
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="border border-foreground/15 px-2 py-1 align-top">
      {children}
    </td>
  ),

  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? '')
    if (isBlock) {
      return (
        <code className={cn('font-mono text-[12.5px] leading-relaxed', className)} {...props}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded bg-background/60 px-1 py-0.5 font-mono text-[0.85em] wrap-break-word"
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
}

interface MarkdownProps {
  children: string
  className?: string
}

function MarkdownInner({ children, className }: MarkdownProps) {
  return (
    <div className={cn('text-sm leading-relaxed', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

export const Markdown = memo(MarkdownInner)
