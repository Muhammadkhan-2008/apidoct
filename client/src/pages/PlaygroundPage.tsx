import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  Trash2,
  Globe,
  MessageSquare,
  Cpu,
  Brain,
  Sparkles,
  ChevronDown,
  RefreshCw,
  Zap,
  SlidersHorizontal,
  Sliders,
  X,
  Menu,
  KeyRound,
  BarChart3,
  Award,
  ArrowUp,
} from 'lucide-react'
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
  reasoning?: string
  isThinking?: boolean
  images?: string[]
  isError?: boolean
  searchSources?: Array<{ title: string; url: string; snippet: string }>
  meta?: {
    platform?: string
    model?: string
    latency?: number
    fallbackAttempts?: number
    reasoningEffort?: string
    agentMode?: boolean
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

type ReasoningEffort = 'off' | 'low' | 'medium' | 'high'
type AgentPersonaKey = 'reasoner' | 'coder' | 'researcher' | 'custom'

interface AgentPersona {
  name: string
  description: string
  prompt: string
  defaultEffort: ReasoningEffort
}

const AGENT_PERSONAS: Record<AgentPersonaKey, AgentPersona> = {
  reasoner: {
    name: '🧠 Deep Reasoner',
    description: 'Autonomous step-by-step analytical reasoning and mathematical verification',
    prompt:
      'You are an autonomous AI reasoning agent. For every task, analyze problems step-by-step, verify constraints, evaluate hypotheses, and outline your thought process rigorously before providing your final answer.',
    defaultEffort: 'high',
  },
  coder: {
    name: '💻 Autonomous Coder',
    description: 'Architecture design, bug debugging, test cases & production-ready code',
    prompt:
      'You are a principal software engineer and coding agent. Break down software requirements into architecture, edge cases, implementation steps, and deliver modular, production-ready code with explanatory comments.',
    defaultEffort: 'high',
  },
  researcher: {
    name: '🔍 Deep Researcher',
    description: 'Multi-source synthesis, live facts & rigorous source attribution',
    prompt:
      'You are a rigorous deep research agent. Synthesize real-world information, cross-examine multiple viewpoints, cite verified sources, and organize structured findings.',
    defaultEffort: 'medium',
  },
  custom: {
    name: '⚙️ Custom Agent',
    description: 'Freely customize system prompts and behavior',
    prompt: '',
    defaultEffort: 'medium',
  },
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
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<ChatSession[]>(loadSavedSessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const saved = loadSavedSessions()
    return saved.length > 0 ? saved[0].id : null
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)

  const currentSession = sessions.find((s) => s.id === activeSessionId)
  const messages = currentSession?.messages ?? []

  const setMessages = (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setSessions((prevSessions) => {
      let targetId = activeSessionId
      let currentList = prevSessions

      if (!targetId) {
        const newId = `session_${Date.now()}`
        targetId = newId
        setActiveSessionId(newId)
        currentList = [{ id: newId, title: 'New Conversation', createdAt: Date.now(), messages: [] }, ...prevSessions]
      }

      const updated = currentList.map((s) => {
        if (s.id !== targetId) return s
        const nextMsgs = typeof updater === 'function' ? updater(s.messages) : updater
        const firstUserMsg = nextMsgs.find((m) => m.role === 'user')?.content.slice(0, 30) ?? 'New Conversation'
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
    const updated = sessions.filter((s) => s.id !== id)
    setSessions(updated)
    if (activeSessionId === id) {
      setActiveSessionId(updated.length > 0 ? updated[0].id : null)
    }
    saveSessionsToStorage(updated)
  }

  // Agentic & System Prompt State
  const [agentMode, setAgentMode] = useState<boolean>(() => localStorage.getItem('playground.agentMode') === '1')
  const [agentPersona, setAgentPersona] = useState<AgentPersonaKey>(
    () => (localStorage.getItem('playground.agentPersona') as AgentPersonaKey) || 'reasoner',
  )
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    () => (localStorage.getItem('playground.reasoningEffort') as ReasoningEffort) || 'high',
  )
  const [systemPrompt, setSystemPrompt] = useState<string>(
    () => localStorage.getItem('playground.systemPrompt') ?? '',
  )

  const [collapsedReasoning, setCollapsedReasoning] = useState<Record<number, boolean>>({})

  const toggleReasoningCollapse = (idx: number) => {
    setCollapsedReasoning((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  const updateSystemPrompt = (v: string) => {
    setSystemPrompt(v)
    localStorage.setItem('playground.systemPrompt', v)
  }

  const toggleAgentMode = () => {
    setAgentMode((prev) => {
      const next = !prev
      localStorage.setItem('playground.agentMode', next ? '1' : '0')
      if (next && !systemPrompt) {
        updateSystemPrompt(AGENT_PERSONAS[agentPersona].prompt)
        setReasoningEffort(AGENT_PERSONAS[agentPersona].defaultEffort)
      }
      return next
    })
  }

  const selectPersona = (key: AgentPersonaKey) => {
    setAgentPersona(key)
    localStorage.setItem('playground.agentPersona', key)
    updateSystemPrompt(AGENT_PERSONAS[key].prompt)
    setReasoningEffort(AGENT_PERSONAS[key].defaultEffort)
    localStorage.setItem('playground.reasoningEffort', AGENT_PERSONAS[key].defaultEffort)
  }

  const updateEffort = (effort: ReasoningEffort) => {
    setReasoningEffort(effort)
    localStorage.setItem('playground.reasoningEffort', effort)
  }

  // Live Model Scanning
  const [scanningModels, setScanningModels] = useState<boolean>(false)
  const [scanResult, setScanResult] = useState<string | null>(null)

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

  const { data: fallbackEntries = [], refetch: refetchFallback } = useQuery<FallbackEntry[]>({
    queryKey: ['fallback'],
    queryFn: () => apiFetch('/api/fallback'),
  })

  const availableModels = fallbackEntries.filter((e) => e.keyCount > 0 && e.enabled)
  const modelOptions = buildModelOptions(availableModels, true)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleScanFreeModels = async () => {
    setScanningModels(true)
    setScanResult(null)
    try {
      const res = await apiFetch<{
        success: boolean
        scanned: number
        inserted: number
        updated: number
        message: string
      }>('/api/models/scan', {
        method: 'POST',
      })
      setScanResult(`✓ ${res.scanned} free models verified (${res.inserted} newly added, ${res.updated} refreshed)`)
      await refetchFallback()
    } catch (err: any) {
      setScanResult(`Scan error: ${err?.message ?? String(err)}`)
    } finally {
      setScanningModels(false)
      setTimeout(() => setScanResult(null), 7000)
    }
  }

  const streamFusion = async (
    stream: ReadableStream<Uint8Array>,
    baseMessages: ChatMessage[],
    start: number,
    searchSources?: any[],
  ) => {
    const reader = stream.getReader()
    const dec = new TextDecoder()
    let buf = ''
    let finalContent = ''
    const panel: FusionPanelEntry[] = []
    let judge: { platform: string; model: string } | null = null

    const flush = (streaming: boolean) => {
      setMessages([
        ...baseMessages,
        {
          role: 'assistant',
          content: finalContent,
          searchSources,
          meta: { latency: Date.now() - start, fusionPanel: [...panel], fusionJudge: judge, fusionStreaming: streaming },
        },
      ])
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
              const item = panel.find((p) => p.platform === frame.platform && p.model === frame.model)
              if (item) {
                item.status = frame.status
                item.content = frame.content
                item.error = frame.error
              }
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

    if (webSearchEnabled || (agentMode && agentPersona === 'researcher')) {
      try {
        const searchRes = await apiFetch<{ results: Array<{ title: string; url: string; snippet: string }> }>('/api/search', {
          method: 'POST',
          body: JSON.stringify({ query: input.trim() }),
        })
        if (searchRes && searchRes.results && searchRes.results.length > 0) {
          searchSources = searchRes.results
          searchContextText =
            `\n\n[LIVE WEB SEARCH CONTEXT]\n` +
            searchRes.results.map((r) => `Source: ${r.title} (${r.url})\nSnippet: ${r.snippet}`).join('\n\n')
        }
      } catch (err) {
        console.warn('[WebSearch] Failed to fetch live search context:', err)
      }
    }

    const start = Date.now()
    const requestMessages: Array<{ role: string; content: string }> = []

    const effectivePrompt =
      systemPrompt.trim() || (agentMode ? AGENT_PERSONAS[agentPersona].prompt : '')

    if (effectivePrompt) {
      requestMessages.push({ role: 'system', content: effectivePrompt + searchContextText })
    } else if (searchContextText) {
      requestMessages.push({
        role: 'system',
        content: 'You have access to live web search results. Cite sources when answering.' + searchContextText,
      })
    }

    for (const msg of newMessages) {
      requestMessages.push({ role: msg.role, content: msg.content })
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (keyData?.apiKey) headers['Authorization'] = `Bearer ${keyData.apiKey}`

      const requestBody: Record<string, any> = {
        model: selectedModel,
        messages: requestMessages,
        stream: true,
      }

      if (reasoningEffort !== 'off') {
        requestBody.reasoning_effort = reasoningEffort
      }

      const res = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
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
        let rawContent = ''
        let rawReasoning = ''

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
              const choice = parsed.choices?.[0]
              const deltaContent = choice?.delta?.content ?? ''
              const deltaReasoning = choice?.delta?.reasoning_content ?? choice?.delta?.reasoning ?? ''

              if (deltaReasoning) {
                rawReasoning += deltaReasoning
              }
              if (deltaContent) {
                rawContent += deltaContent
              }

              // Parse <think> tags if model returns think blocks inside content
              let displayContent = rawContent
              let displayReasoning = rawReasoning
              if (displayContent.includes('<think>')) {
                const startIdx = displayContent.indexOf('<think>') + 7
                const endIdx = displayContent.indexOf('</think>')
                if (endIdx !== -1) {
                  const thinkPart = displayContent.substring(startIdx, endIdx)
                  if (!displayReasoning.includes(thinkPart.trim())) {
                    displayReasoning = (displayReasoning ? displayReasoning + '\n' : '') + thinkPart.trim()
                  }
                  displayContent = displayContent.substring(0, startIdx - 7) + displayContent.substring(endIdx + 8)
                } else {
                  const thinkStreaming = displayContent.substring(startIdx)
                  displayReasoning = (displayReasoning ? displayReasoning + '\n' : '') + thinkStreaming
                  displayContent = displayContent.substring(0, startIdx - 7)
                }
              }

              const isStillThinking = !displayContent.trim() && Boolean(displayReasoning.trim())

              setMessages([
                ...newMessages,
                {
                  role: 'assistant',
                  content: displayContent,
                  reasoning: displayReasoning,
                  isThinking: isStillThinking,
                  searchSources,
                  meta: {
                    platform: platformHeader,
                    model: modelHeader,
                    latency: Date.now() - start,
                    fallbackAttempts,
                    reasoningEffort,
                    agentMode,
                  },
                },
              ])
            } catch {}
          }
        }

        // Final cleanup pass
        setMessages((prev) => {
          return prev.map((msg, i) => {
            if (i !== prev.length - 1) return msg
            return {
              ...msg,
              isThinking: false,
            }
          })
        })
      } else {
        const json = await res.json()
        const choice = json.choices?.[0]
        let content = choice?.message?.content ?? ''
        let reasoning = choice?.message?.reasoning_content ?? choice?.message?.reasoning ?? ''

        if (content.includes('<think>')) {
          const startIdx = content.indexOf('<think>') + 7
          const endIdx = content.indexOf('</think>')
          if (endIdx !== -1) {
            const thinkPart = content.substring(startIdx, endIdx)
            reasoning = (reasoning ? reasoning + '\n' : '') + thinkPart.trim()
            content = content.substring(0, startIdx - 7) + content.substring(endIdx + 8)
          }
        }

        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content,
            reasoning,
            isThinking: false,
            searchSources,
            meta: {
              platform: platformHeader,
              model: modelHeader,
              latency: Date.now() - start,
              fallbackAttempts,
              reasoningEffort,
              agentMode,
            },
          },
        ])
      }
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: err?.message ?? String(err), isError: true, searchSources },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground relative">
      {/* Slide-out Drawer for Mobile & Tablet (when mobileSidebarOpen is true) */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          {/* Drawer Panel */}
          <aside className="relative z-10 w-72 max-w-[85vw] h-full bg-card/95 border-r border-border/40 flex flex-col shadow-2xl backdrop-blur-2xl">
            {/* Drawer Header */}
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <span className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 text-white font-black text-xs">
                  A
                </span>
                <span>ApiDoct Chat</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40"
                title="Close drawer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* New Chat Button */}
            <div className="p-3 border-b border-border/40">
              <Button
                onClick={() => {
                  handleNewSession()
                  setMobileSidebarOpen(false)
                }}
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold text-xs rounded-xl shadow-md glow-indigo py-2"
              >
                <Plus className="size-4 mr-1.5" />
                New Conversation
              </Button>
            </div>

            {/* Saved Sessions List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
              {sessions.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground pt-8">No saved chats yet.</p>
              ) : (
                sessions.map((s) => {
                  const active = s.id === activeSessionId
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setActiveSessionId(s.id)
                        setMobileSidebarOpen(false)
                      }}
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
                        className="p-1 text-muted-foreground hover:text-rose-400 transition-opacity"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Drawer Footer Navigation */}
            <div className="p-3 border-t border-border/40 bg-card/60 space-y-1 text-xs">
              <p className="text-[10px] font-black text-muted-foreground uppercase px-2 py-1">Navigation</p>
              <button
                onClick={() => {
                  setMobileSidebarOpen(false)
                  navigate('/keys')
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl font-bold text-muted-foreground hover:text-indigo-300 hover:bg-accent/40 text-left"
              >
                <KeyRound className="size-3.5 text-indigo-400" />
                <span>Provider Keys</span>
              </button>
              <button
                onClick={() => {
                  setMobileSidebarOpen(false)
                  navigate('/models/chat')
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl font-bold text-muted-foreground hover:text-cyan-300 hover:bg-accent/40 text-left"
              >
                <Cpu className="size-3.5 text-cyan-400" />
                <span>Inference Models</span>
              </button>
              <button
                onClick={() => {
                  setMobileSidebarOpen(false)
                  navigate('/analytics')
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl font-bold text-muted-foreground hover:text-emerald-300 hover:bg-accent/40 text-left"
              >
                <BarChart3 className="size-3.5 text-emerald-400" />
                <span>Telemetry</span>
              </button>
              <button
                onClick={() => {
                  setMobileSidebarOpen(false)
                  navigate('/premium')
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl font-bold text-muted-foreground hover:text-amber-300 hover:bg-accent/40 text-left"
              >
                <Award className="size-3.5 text-amber-400" />
                <span>ApiDoct Pro</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sessions Sidebar (Pinned on xl: screens) */}
      <aside className="hidden xl:flex xl:w-64 shrink-0 border-r border-border/40 bg-card/30 flex-col h-full">
        <div className="p-4 border-b border-border/40 flex items-center justify-between">
          <Button
            onClick={handleNewSession}
            className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-extrabold text-xs rounded-xl shadow-md glow-indigo"
          >
            <Plus className="size-4 mr-1.5" />
            New Conversation
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {sessions.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground pt-8">No saved chats yet.</p>
          ) : (
            sessions.map((s) => {
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
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* ChatGPT-style Single-Row Top Header */}
        <header className="h-14 shrink-0 border-b border-border/40 bg-card/30 backdrop-blur-xl px-3 sm:px-6 flex items-center justify-between gap-2 z-10">
          {/* Left: Menu Drawer Toggle on mobile/tablet */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="xl:hidden flex size-9 items-center justify-center rounded-xl border border-white/10 bg-card/60 text-foreground hover:bg-accent/50 active:scale-95 transition-all shadow-xs"
              title="Open Conversations"
              aria-label="Open Conversations"
            >
              <Menu className="size-4" />
            </button>
          </div>

          {/* Center: Model Selector Pill (ChatGPT style) */}
          <div className="flex items-center justify-center flex-1 min-w-0 max-w-sm mx-auto">
            <ModelCombobox
              value={selectedModel}
              onSelect={(val) => {
                setSelectedModel(val)
                localStorage.setItem('playground.model', val)
              }}
              options={modelOptions}
              ariaLabel="Select model"
              placeholder="Search model..."
              emptyText="No model found"
              triggerClassName="flex h-9 w-full max-w-[200px] sm:max-w-[260px] items-center justify-between gap-1.5 rounded-2xl border border-white/10 bg-card/70 px-3 text-xs font-bold outline-none hover:bg-accent/50 text-foreground shadow-xs transition-colors"
            />
          </div>

          {/* Right Actions: Scan, Options, and New Chat */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Scan Free Models */}
            <button
              type="button"
              onClick={handleScanFreeModels}
              disabled={scanningModels}
              className="flex size-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 active:scale-95 transition-all shadow-xs"
              title={scanningModels ? "Scanning for free models..." : "Scan live free models"}
            >
              <RefreshCw className={`size-4 ${scanningModels ? 'animate-spin' : ''}`} />
            </button>

            {/* Agent Settings & Tuning Options Modal Trigger */}
            <button
              type="button"
              onClick={() => setOptionsOpen(true)}
              className={`relative flex size-9 items-center justify-center rounded-xl border transition-all active:scale-95 shadow-xs ${
                agentMode || webSearchEnabled || systemPrompt
                  ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
                  : 'border-white/10 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
              title="Agent options & persona presets"
            >
              <SlidersHorizontal className="size-4" />
              {(agentMode || webSearchEnabled || systemPrompt) && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </button>

            {/* New Chat Button */}
            <button
              type="button"
              onClick={handleNewSession}
              className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold hover:opacity-90 active:scale-95 shadow-md glow-indigo"
              title="Start new conversation"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </header>

        {/* Free Scan Status Toast */}
        {scanResult && (
          <div className="px-4 py-2 bg-gradient-to-r from-cyan-950/70 to-indigo-950/70 border-b border-cyan-500/30 text-xs font-semibold text-cyan-300 flex items-center justify-between animate-fade-in shrink-0">
            <span className="flex items-center gap-2">
              <Zap className="size-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">{scanResult}</span>
            </span>
            <button onClick={() => setScanResult(null)} className="text-cyan-400/60 hover:text-cyan-200 text-xs ml-2">
              ✕
            </button>
          </div>
        )}

        {/* Chat Messages Stream */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center space-y-3 p-6 text-muted-foreground max-w-md mx-auto">
              <div className="relative">
                <div className="size-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-xl">
                  <Brain className="size-6 text-white" />
                </div>
                {agentMode && (
                  <Sparkles className="size-5 text-cyan-400 absolute -top-1 -right-1 animate-pulse" />
                )}
              </div>
              <h3 className="text-base font-extrabold text-foreground">
                ApiDoct AI Assistant
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                What can I help you with today? Choose any model, activate autonomous reasoning, or ask for code with live in-browser preview.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl w-full mx-auto space-y-4">
              {messages.map((msg, index) => {
                const isCollapsed = collapsedReasoning[index] ?? false
                return (
                  <div
                    key={index}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full`}
                  >
                    <div
                      className={`rounded-3xl p-3.5 sm:p-4 text-xs sm:text-sm shadow-md break-words overflow-hidden ${
                        msg.role === 'user'
                          ? 'max-w-[85%] bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-br-none font-medium ml-auto'
                          : msg.isError
                            ? 'w-full bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-bl-none'
                            : 'w-full bg-card/80 border border-white/10 text-foreground rounded-bl-none shadow-sm'
                      }`}
                    >
                      {/* Live Web Search Citations */}
                      {msg.searchSources && msg.searchSources.length > 0 && (
                        <div className="mb-3 p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 space-y-1">
                          <p className="font-extrabold flex items-center gap-1.5">
                            <Globe className="size-3.5 shrink-0" />
                            <span>Live Web Citations ({msg.searchSources.length} sources)</span>
                          </p>
                          <ul className="space-y-0.5 pl-4 list-disc text-[10px] text-emerald-300/80">
                            {msg.searchSources.slice(0, 3).map((s, i) => (
                              <li key={i} className="truncate">
                                <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-emerald-200">
                                  {s.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Reasoning Accordion */}
                      {Boolean(msg.reasoning) && (
                        <div className="mb-3 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-card/60 backdrop-blur-xl overflow-hidden shadow-lg transition-all">
                          <button
                            type="button"
                            onClick={() => toggleReasoningCollapse(index)}
                            className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center justify-between text-xs font-bold text-indigo-300 hover:bg-indigo-500/10 transition-colors gap-2"
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <Brain className={`size-3.5 shrink-0 text-cyan-400 ${msg.isThinking ? 'animate-pulse' : ''}`} />
                              <span className="truncate">
                                {msg.isThinking ? 'Thinking & Reasoning...' : 'Thought Process'}
                              </span>
                              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/20 text-indigo-200 font-mono border border-indigo-500/30 shrink-0">
                                {msg.reasoning?.length ?? 0} chars
                              </span>
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium shrink-0">
                              <span>{isCollapsed ? 'Show' : 'Hide'}</span>
                              <ChevronDown className={`size-3 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`} />
                            </span>
                          </button>
                          {!isCollapsed && (
                            <div className="px-3 pb-3 pt-1 text-[11px] font-mono text-muted-foreground/90 whitespace-pre-wrap leading-relaxed border-t border-indigo-500/20 bg-black/40 custom-scrollbar max-h-80 overflow-y-auto select-text break-words">
                              {msg.reasoning}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Message Content */}
                      {msg.content ? (
                        <Markdown>{msg.content}</Markdown>
                      ) : msg.isThinking ? (
                        <div className="flex items-center gap-2 py-2 text-indigo-400 text-xs italic">
                          <Brain className="size-4 animate-spin text-cyan-400" />
                          <span>Synthesizing response from reasoning steps...</span>
                        </div>
                      ) : null}

                      {/* Meta Footer */}
                      {msg.meta && (
                        <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono flex-wrap gap-2">
                          <span className="flex items-center gap-1.5">
                            <span>{msg.meta.model ?? 'ApiDoct Router'}</span>
                            {msg.meta.reasoningEffort && msg.meta.reasoningEffort !== 'off' && (
                              <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] uppercase font-bold">
                                CoT: {msg.meta.reasoningEffort}
                              </span>
                            )}
                            {msg.meta.agentMode && (
                              <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">
                                Agent
                              </span>
                            )}
                          </span>
                          {msg.meta.latency && <span>{msg.meta.latency} ms</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ChatGPT-style Bottom Prompt Bar */}
        <div className="p-2 sm:p-4 shrink-0 bg-gradient-to-t from-background via-background/90 to-transparent">
          <div className="max-w-3xl w-full mx-auto">
            <div className="flex items-end gap-1.5 sm:gap-2 bg-card/90 border border-white/15 rounded-3xl p-1.5 sm:p-2 shadow-2xl focus-within:border-indigo-500/60 transition-all">
              {/* Quick Web Search Toggle Button */}
              <button
                type="button"
                onClick={() => setWebSearchEnabled((v) => !v)}
                className={`size-8 sm:size-9 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
                  webSearchEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 glow-emerald'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                }`}
                title={webSearchEnabled ? 'Web search enabled' : 'Enable live web search'}
              >
                <Globe className="size-4" />
              </button>

              {/* Quick Agent Reasoning Toggle Button */}
              <button
                type="button"
                onClick={toggleAgentMode}
                className={`size-8 sm:size-9 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
                  agentMode
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 glow-indigo'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                }`}
                title={agentMode ? 'Agent Mode enabled' : 'Enable Autonomous Agent mode'}
              >
                <Sparkles className="size-4" />
              </button>

              {/* Prompt Textarea */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder={
                  agentMode
                    ? `[${AGENT_PERSONAS[agentPersona].name}] Message ApiDoct...`
                    : 'Message ApiDoct...'
                }
                rows={1}
                className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-foreground outline-none resize-none px-2 py-2 min-h-[36px] max-h-36 custom-scrollbar"
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="size-8 sm:size-9 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95 active:scale-95 shadow-md glow-indigo transition-all"
                title="Send message"
              >
                <ArrowUp className="size-4" />
              </button>
            </div>
            <p className="text-[10px] text-center text-muted-foreground mt-1.5 font-medium hidden sm:block">
              ApiDoct provides free, unified gateway routing with autonomous reasoning.
            </p>
          </div>
        </div>

        {/* Agent Options & Tuning Bottom-Sheet / Modal (optionsOpen) */}
        {optionsOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setOptionsOpen(false)}
            />

            {/* Modal Panel */}
            <div className="relative z-10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/10 bg-card/95 p-5 shadow-2xl backdrop-blur-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
                <div className="flex items-center gap-2">
                  <Sliders className="size-4 text-indigo-400" />
                  <h3 className="font-extrabold text-sm text-foreground">Playground & Agent Options</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOptionsOpen(false)}
                  className="size-7 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Agent Mode Switch */}
              <div className="mb-4 p-3 rounded-2xl border border-white/10 bg-accent/20 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-cyan-400" />
                    Autonomous Agent Mode
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Enables deep step-by-step reasoning & specialized personas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleAgentMode}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                    agentMode
                      ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow'
                      : 'border-border/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {agentMode ? 'ACTIVE' : 'OFF'}
                </button>
              </div>

              {/* Persona Preset Picker */}
              <div className="mb-4">
                <label className="text-xs font-bold text-muted-foreground block mb-2">Agent Persona Presets</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(AGENT_PERSONAS) as AgentPersonaKey[]).map((key) => {
                    const p = AGENT_PERSONAS[key]
                    const active = agentPersona === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectPersona(key)}
                        className={`p-2.5 rounded-2xl border text-left transition-all ${
                          active
                            ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-200 shadow-sm'
                            : 'border-white/10 bg-accent/10 text-muted-foreground hover:text-foreground hover:bg-accent/20'
                        }`}
                      >
                        <p className="font-extrabold text-xs">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground/80 line-clamp-2 mt-0.5">
                          {p.description}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Reasoning Effort (CoT) */}
              <div className="mb-4">
                <label className="text-xs font-bold text-muted-foreground block mb-2">
                  Chain-of-Thought Reasoning Effort
                </label>
                <div className="grid grid-cols-4 gap-1.5 bg-card/60 border border-white/10 rounded-2xl p-1 text-xs font-bold">
                  {(['off', 'low', 'medium', 'high'] as ReasoningEffort[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => updateEffort(lvl)}
                      className={`py-1.5 rounded-xl uppercase text-center transition-all ${
                        reasoningEffort === lvl
                          ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow font-extrabold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Web Search Citations */}
              <div className="mb-4 p-3 rounded-2xl border border-white/10 bg-accent/20 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Globe className="size-3.5 text-emerald-400" />
                    Live Web Search
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Fetches verified real-time web citations for answers
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWebSearchEnabled((v) => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                    webSearchEnabled
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow'
                      : 'border-border/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {webSearchEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* System Instructions Prompt */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Custom System Instructions</label>
                  <button
                    type="button"
                    onClick={() => updateSystemPrompt(AGENT_PERSONAS[agentPersona].prompt)}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    Reset Preset
                  </button>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => updateSystemPrompt(e.target.value)}
                  placeholder="Instruct model behavior, persona, rules, constraints..."
                  className="w-full h-24 bg-card/60 border border-white/10 rounded-2xl p-3 text-xs outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Done Button */}
              <Button
                onClick={() => setOptionsOpen(false)}
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-extrabold text-xs rounded-xl py-2.5 shadow-md glow-indigo"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
