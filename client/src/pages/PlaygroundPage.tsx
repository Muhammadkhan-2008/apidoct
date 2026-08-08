import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, Globe, MessageSquare, Send, Cpu } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ModelCombobox } from '@/components/model-combobox'
import { buildModelOptions } from '@/lib/model-groups'
import { Markdown } from '@/components/markdown'

interface FallbackEntry {
  modelDbId: number
  priority: number
  enabled: boolean
  platform: string
  modelId: string
  canonicalId?: string
  displayName: string
  sizeLabel: string
  intelligenceRank: number
  supportsVision: boolean
  keyCount: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  isError?: boolean
  searchSources?: Array<{ title: string; url: string; snippet: string }>
  meta?: {
    platform?: string
    model?: string
    latency?: number
    fallbackAttempts?: number
    fusionPanel?: FusionPanelEntry[]
    fusionJudge?: { platform: string; model: string } | null
    fusionStreaming?: boolean
  }
}

interface FusionPanelEntry {
  platform: string
  model: string
  status?: 'ok' | 'failed'
  content?: string
  error?: string
}

interface ChatSession {
  id: string
  title: string
  createdAt: number
  messages: ChatMessage[]
}

function loadSavedSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem('apidoct_playground_sessions')
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveSessionsToStorage(sessions: ChatSession[]) {
  try {
    localStorage.setItem('apidoct_playground_sessions', JSON.stringify(sessions))
  } catch {}
}

export default function PlaygroundPage() {
  const [sessions, setSessions] = useState<ChatSession[]>(loadSavedSessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const saved = loadSavedSessions()
    return saved.length > 0 ? saved[0].id : null
  })

  const currentSession = sessions.find(s => s.id === activeSessionId)
  const messages = currentSession?.messages ?? []

  const setMessages = (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setSessions(prevSessions => {
      let targetId = activeSessionId
      let currentList = prevSessions

      if (!targetId) {
        const newId = `session_${Date.now()}`
        targetId = newId
        setActiveSessionId(newId)
        currentList = [{ id: newId, title: 'New Conversation', createdAt: Date.now(), messages: [] }, ...prevSessions]
      }

      const updated = currentList.map(s => {
        if (s.id !== targetId) return s
        const nextMsgs = typeof updater === 'function' ? updater(s.messages) : updater
        const firstUserMsg = nextMsgs.find(m => m.role === 'user')?.content.slice(0, 30) ?? 'New Conversation'
        return { ...s, title: firstUserMsg, messages: nextMsgs }
      })

      saveSessionsToStorage(updated)
      return updated
    })
  }

  const handleNewSession = () => {
    const newId = `session_${Date.now()}`
    const newSess: ChatSession = { id: newId, title: 'New Conversation', createdAt: Date.now(), messages: [] }
    const updated = [newSess, ...sessions]
    setSessions(updated)
    setActiveSessionId(newId)
    saveSessionsToStorage(updated)
  }

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = sessions.filter(s => s.id !== id)
    setSessions(updated)
    if (activeSessionId === id) {
      setActiveSessionId(updated.length > 0 ? updated[0].id : null)
    }
    saveSessionsToStorage(updated)
  }

  const [systemPrompt, setSystemPrompt] = useState<string>(
    () => localStorage.getItem('playground.systemPrompt') ?? '',
  )
  const [systemPromptOpen, setSystemPromptOpen] = useState<boolean>(
    () => !!localStorage.getItem('playground.systemPrompt'),
  )
  const updateSystemPrompt = (v: string) => {
    setSystemPrompt(v)
    localStorage.setItem('playground.systemPrompt', v)
  }

  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem('playground.model') ?? 'auto',
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: keyData } = useQuery<{ apiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  const { data: fallbackEntries = [] } = useQuery<FallbackEntry[]>({
    queryKey: ['fallback'],
    queryFn: () => apiFetch('/api/fallback'),
  })

  const availableModels = fallbackEntries.filter(e => e.keyCount > 0 && e.enabled)
  const modelOptions = buildModelOptions(availableModels, true)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const streamFusion = async (stream: ReadableStream<Uint8Array>, baseMessages: ChatMessage[], start: number, searchSources?: any[]) => {
    const reader = stream.getReader()
    const dec = new TextDecoder()
    let buf = ''
    let finalContent = ''
    const panel: FusionPanelEntry[] = []
    let judge: { platform: string; model: string } | null = null

    const flush = (streaming: boolean) => {
      setMessages([...baseMessages, {
        role: 'assistant',
        content: finalContent,
        searchSources,
        meta: { latency: Date.now() - start, fusionPanel: [...panel], fusionJudge: judge, fusionStreaming: streaming },
      }])
    }
    flush(true)

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          if (parsed._fusion) {
            const frame = parsed._fusion
            if (frame.type === 'panel_start') {
              panel.push({ platform: frame.platform, model: frame.model })
            } else if (frame.type === 'panel_result') {
              const item = panel.find(p => p.platform === frame.platform && p.model === frame.model)
              if (item) { item.status = frame.status; item.content = frame.content; item.error = frame.error }
            } else if (frame.type === 'judge') {
              judge = { platform: frame.platform, model: frame.model }
            }
            flush(true)
          } else {
            const delta = parsed.choices?.[0]?.delta?.content ?? ''
            if (delta) {
              finalContent += delta
              flush(true)
            }
          }
        } catch {}
      }
    }
    flush(false)
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    let searchSources: Array<{ title: string; url: string; snippet: string }> | undefined = undefined
    let searchContextText = ''

    if (webSearchEnabled) {
      try {
        const searchRes = await apiFetch<{ results: Array<{ title: string; url: string; snippet: string }> }>('/api/search', {
          method: 'POST',
          body: JSON.stringify({ query: input.trim() }),
        })
        if (searchRes && searchRes.results && searchRes.results.length > 0) {
          searchSources = searchRes.results
          searchContextText = `\n\n[LIVE WEB SEARCH CONTEXT]\n` + searchRes.results.map(r => `Source: ${r.title} (${r.url})\nSnippet: ${r.snippet}`).join('\n\n')
        }
      } catch (err) {
        console.warn('[WebSearch] Failed to fetch live search context:', err)
      }
    }

    const start = Date.now()
    const requestMessages: Array<{ role: string; content: string }> = []

    if (systemPrompt.trim()) {
      requestMessages.push({ role: 'system', content: systemPrompt.trim() + searchContextText })
    } else if (searchContextText) {
      requestMessages.push({ role: 'system', content: 'You have access to live web search results. Cite sources when answering.' + searchContextText })
    }

    for (const msg of newMessages) {
      requestMessages.push({ role: msg.role, content: msg.content })
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (keyData?.apiKey) headers['Authorization'] = `Bearer ${keyData.apiKey}`

      const res = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: selectedModel,
          messages: requestMessages,
          stream: true,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        let parsedMessage = errorText
        try {
          const json = JSON.parse(errorText)
          if (json.error?.message) parsedMessage = json.error.message
        } catch {}
        setMessages([...newMessages, { role: 'assistant', content: parsedMessage, isError: true, searchSources }])
        setLoading(false)
        return
      }

      const platformHeader = res.headers.get('x-freellmapi-platform') ?? undefined
      const modelHeader = res.headers.get('x-freellmapi-model') ?? undefined
      const attemptsHeader = res.headers.get('x-freellmapi-attempts')
      const fallbackAttempts = attemptsHeader ? parseInt(attemptsHeader, 10) : undefined

      if (res.headers.get('content-type')?.includes('text/event-stream') && selectedModel === 'fusion') {
        await streamFusion(res.body!, newMessages, start, searchSources)
        setLoading(false)
        return
      }

      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body!.getReader()
        const dec = new TextDecoder()
        let buf = ''
        let content = ''

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content ?? ''
              content += delta
              setMessages([...newMessages, {
                role: 'assistant',
                content,
                searchSources,
                meta: { platform: platformHeader, model: modelHeader, latency: Date.now() - start, fallbackAttempts },
              }])
            } catch {}
          }
        }
      } else {
        const json = await res.json()
        const content = json.choices?.[0]?.message?.content ?? ''
        setMessages([...newMessages, {
          role: 'assistant',
          content,
          searchSources,
          meta: { platform: platformHeader, model: modelHeader, latency: Date.now() - start, fallbackAttempts },
        }])
      }
    } catch (err: any) {
      setMessages([...newMessages, { role: 'assistant', content: err?.message ?? String(err), isError: true, searchSources }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] rounded-3xl border border-white/10 glass-card overflow-hidden shadow-2xl bg-card/60 backdrop-blur-2xl">
      {/* Left Chat Sessions Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border/40 bg-card/40 flex flex-col h-full">
        <div className="p-4 border-b border-border/40 flex items-center justify-between">
          <Button onClick={handleNewSession} className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-extrabold text-xs rounded-xl shadow-md glow-indigo">
            <Plus className="size-4 mr-1.5" />
            New Conversation
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {sessions.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground pt-8">No saved chats yet.</p>
          ) : (
            sessions.map(s => {
              const active = s.id === activeSessionId
              return (
                <div
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer text-xs font-semibold transition-all ${
                    active
                      ? 'bg-gradient-to-r from-indigo-500/20 to-cyan-500/10 text-indigo-300 border border-indigo-500/40 glow-indigo'
                      : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MessageSquare className="size-3.5 shrink-0 text-indigo-400" />
                    <span className="truncate">{s.title || 'Conversation'}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-rose-400 transition-opacity"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </aside>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Controls Header */}
        <div className="h-16 px-6 border-b border-border/40 flex flex-wrap items-center justify-between gap-3 bg-card/20 shrink-0">
          <div className="flex items-center gap-3">
            <ModelCombobox
              value={selectedModel}
              onSelect={val => {
                setSelectedModel(val)
                localStorage.setItem('playground.model', val)
              }}
              options={modelOptions}
              ariaLabel="Select model"
              placeholder="Search model..."
              emptyText="No model found"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWebSearchEnabled(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                webSearchEnabled
                  ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-transparent text-emerald-400 border-emerald-500/40 glow-emerald'
                  : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/30'
              }`}
            >
              <Globe className="size-3.5 text-emerald-400" />
              <span>🌐 Web Search: {webSearchEnabled ? 'Active' : 'Off'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSystemPromptOpen(o => !o)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                systemPromptOpen || systemPrompt
                  ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                  : 'border-border/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              {systemPrompt ? '⚙️ System Prompt (Active)' : '⚙️ Add System Prompt'}
            </button>
          </div>
        </div>

        {systemPromptOpen && (
          <div className="p-4 border-b border-border/40 bg-accent/10 shrink-0">
            <textarea
              value={systemPrompt}
              onChange={e => updateSystemPrompt(e.target.value)}
              placeholder="System prompt: Instruct ApiDoct model behavior, role, constraints..."
              className="w-full h-20 bg-card/60 border border-white/10 rounded-2xl p-3 text-xs outline-none focus:border-indigo-500/50"
            />
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-8 text-muted-foreground">
              <Cpu className="size-10 text-indigo-400 opacity-60" />
              <h3 className="text-sm font-extrabold text-foreground">ApiDoct AI Playground</h3>
              <p className="text-xs max-w-sm">Test any model, enable live web search, or experiment with multi-model fusion routing.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-2xl rounded-3xl p-4 text-xs shadow-md ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-br-none font-medium'
                    : msg.isError
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-bl-none'
                      : 'glass-card border-white/10 bg-card/80 text-foreground rounded-bl-none'
                }`}>
                  {msg.searchSources && msg.searchSources.length > 0 && (
                    <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 space-y-1">
                      <p className="font-extrabold flex items-center gap-1.5">
                        <Globe className="size-3.5" /> Live Web Search Citations ({msg.searchSources.length} sources)
                      </p>
                      <ul className="space-y-0.5 pl-4 list-disc text-[10px] text-emerald-300/80">
                        {msg.searchSources.slice(0, 3).map((s, i) => (
                          <li key={i} className="truncate">
                            <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-emerald-200">{s.title}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Markdown>{msg.content}</Markdown>

                  {msg.meta && (
                    <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>{msg.meta.model ?? 'ApiDoct Router'}</span>
                      {msg.meta.latency && <span>{msg.meta.latency} ms</span>}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-border/40 bg-card/40 shrink-0">
          <div className="flex items-center gap-3 bg-card/60 border border-white/10 rounded-2xl p-2 focus-within:border-indigo-500/50">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Ask ApiDoct anything..."
              className="flex-1 bg-transparent border-0 text-xs text-foreground outline-none resize-none px-2 py-1.5 h-10"
            />
            <Button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl px-4 py-2 text-xs font-bold shadow-md glow-indigo"
            >
              <Send className="size-3.5 mr-1" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
