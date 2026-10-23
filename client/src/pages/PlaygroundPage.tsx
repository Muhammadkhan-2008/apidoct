import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  Trash2,
  Globe,
  MessageSquare,
  Send,
  Cpu,
  Brain,
  Sparkles,
  Bot,
  ChevronDown,
  RefreshCw,
  Zap,
  SlidersHorizontal,
  Menu,
  X,
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
  const [sessions, setSessions] = useState<ChatSession[]>(loadSavedSessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const saved = loadSavedSessions()
    return saved.length > 0 ? saved[0].id : null
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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
  const [systemPromptOpen, setSystemPromptOpen] = useState<boolean>(
    () => !!localStorage.getItem('playground.systemPrompt'),
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
    <div className="flex h-[calc(100dvh-5rem)] sm:h-[calc(100vh-5.5rem)] md:h-[calc(100vh-6rem)] rounded-2xl md:rounded-3xl border border-white/10 glass-card overflow-hidden shadow-2xl bg-card/60 backdrop-blur-2xl relative">
      {/* Mobile Drawer Backdrop & Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-fade-in">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full bg-card/95 border-r border-border/40 flex flex-col shadow-2xl backdrop-blur-xl">
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="size-4 text-indigo-400" />
                Conversations
              </span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-3 border-b border-border/40">
              <Button
                onClick={() => {
                  handleNewSession()
                  setMobileSidebarOpen(false)
                }}
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
          </aside>
        </div>
      )}

      {/* Desktop Chat Sessions Sidebar */}
      <aside className="hidden md:flex md:w-64 shrink-0 border-r border-border/40 bg-card/40 flex-col h-full">
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
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Controls Header */}
        <div className="h-auto min-h-14 sm:min-h-16 px-3 sm:px-6 py-2.5 border-b border-border/40 flex flex-wrap items-center justify-between gap-2 sm:gap-3 bg-card/20 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap flex-1 sm:flex-initial">
            {/* Mobile History / Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden flex items-center justify-center size-8 rounded-xl border border-white/10 bg-card/60 text-muted-foreground hover:text-foreground active:scale-95 shrink-0"
              title="Saved Chats History"
            >
              <Menu className="size-4" />
            </button>

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
            />

            {/* Live Scan Free Models Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleScanFreeModels}
              disabled={scanningModels}
              className="h-8 text-xs font-bold rounded-xl border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50 shrink-0"
            >
              <RefreshCw className={`size-3.5 mr-1 ${scanningModels ? 'animate-spin' : ''}`} />
              <span>{scanningModels ? 'Scanning...' : '⚡ Scan Free'}</span>
            </Button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Agent Mode Toggle */}
            <button
              type="button"
              onClick={toggleAgentMode}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                agentMode
                  ? 'bg-gradient-to-r from-purple-500/25 via-indigo-500/25 to-cyan-500/20 text-cyan-300 border-cyan-500/50 glow-indigo shadow-lg'
                  : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/30'
              }`}
            >
              <Sparkles className={`size-3.5 ${agentMode ? 'text-cyan-400 animate-pulse' : 'text-muted-foreground'}`} />
              <span>Agent: {agentMode ? 'Active' : 'Off'}</span>
            </button>

            {/* Reasoning Effort Pills */}
            <div className="flex items-center bg-card/60 border border-white/10 rounded-xl p-0.5 text-[11px] font-bold">
              <span className="px-1.5 sm:px-2 text-muted-foreground flex items-center gap-1">
                <Brain className="size-3 text-indigo-400" />
                <span className="hidden sm:inline">Effort:</span>
              </span>
              {(['off', 'low', 'medium', 'high'] as ReasoningEffort[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => updateEffort(lvl)}
                  className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg uppercase transition-all text-[10px] sm:text-[11px] ${
                    reasoningEffort === lvl
                      ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-extrabold shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {lvl === 'medium' ? 'med' : lvl}
                </button>
              ))}
            </div>

            {/* Web Search Button */}
            <button
              type="button"
              onClick={() => setWebSearchEnabled((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                webSearchEnabled
                  ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-transparent text-emerald-400 border-emerald-500/40 glow-emerald'
                  : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/30'
              }`}
            >
              <Globe className="size-3.5 text-emerald-400" />
              <span>Web: {webSearchEnabled ? 'On' : 'Off'}</span>
            </button>

            {/* System Prompt Toggle */}
            <button
              type="button"
              onClick={() => setSystemPromptOpen((o) => !o)}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                systemPromptOpen || systemPrompt
                  ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                  : 'border-border/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <SlidersHorizontal className="size-3.5 inline mr-1" />
              {systemPrompt ? 'Prompt*' : 'Prompt'}
            </button>
          </div>
        </div>

        {/* Scan Status Toast Notification */}
        {scanResult && (
          <div className="px-6 py-2 bg-gradient-to-r from-cyan-950/60 to-indigo-950/60 border-b border-cyan-500/30 text-xs font-semibold text-cyan-300 flex items-center justify-between animate-fade-in">
            <span className="flex items-center gap-2">
              <Zap className="size-3.5 text-cyan-400" />
              {scanResult}
            </span>
            <button onClick={() => setScanResult(null)} className="text-cyan-400/60 hover:text-cyan-200 text-xs">
              ✕
            </button>
          </div>
        )}

        {/* Agent Persona Bar (visible in Agent Mode) */}
        {agentMode && (
          <div className="px-3 sm:px-6 py-2 bg-accent/20 border-b border-border/40 flex items-center justify-between gap-2 overflow-x-auto text-xs whitespace-nowrap scrollbar-none">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0">
              <span className="font-bold text-muted-foreground flex items-center gap-1.5 shrink-0">
                <Bot className="size-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Persona:</span>
              </span>
              {(Object.keys(AGENT_PERSONAS) as AgentPersonaKey[]).map((key) => {
                const p = AGENT_PERSONAS[key]
                const active = agentPersona === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectPersona(key)}
                    className={`px-2.5 py-1 rounded-xl font-bold transition-all border text-xs shrink-0 ${
                      active
                        ? 'bg-indigo-500/25 border-indigo-500/50 text-indigo-300 shadow-sm'
                        : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-card/40'
                    }`}
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
            <span className="text-[11px] text-muted-foreground hidden lg:inline shrink-0">
              {AGENT_PERSONAS[agentPersona].description}
            </span>
          </div>
        )}

        {/* Custom System Prompt Drawer */}
        {systemPromptOpen && (
          <div className="p-3 sm:p-4 border-b border-border/40 bg-accent/10 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-indigo-300">Agent System Instructions</label>
              <button
                type="button"
                onClick={() => updateSystemPrompt(AGENT_PERSONAS[agentPersona].prompt)}
                className="text-[11px] text-cyan-400 hover:underline"
              >
                Reset to {AGENT_PERSONAS[agentPersona].name} Preset
              </button>
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => updateSystemPrompt(e.target.value)}
              placeholder="System prompt: Instruct ApiDoct model behavior, role, constraints..."
              className="w-full h-20 bg-card/60 border border-white/10 rounded-2xl p-3 text-xs outline-none focus:border-indigo-500/50"
            />
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-6 sm:p-8 text-muted-foreground">
              <div className="relative">
                <Cpu className="size-10 sm:size-12 text-indigo-400 opacity-60" />
                {agentMode && (
                  <Sparkles className="size-4 sm:size-5 text-cyan-400 absolute -top-1 -right-1 animate-pulse" />
                )}
              </div>
              <h3 className="text-sm font-extrabold text-foreground">
                ApiDoct AI Playground {agentMode && '— Autonomous Agent Mode'}
              </h3>
              <p className="text-xs max-w-md leading-relaxed text-muted-foreground">
                Test any model, stream DeepSeek / Gemini step-by-step reasoning, enable real-time web citations, or
                switch to autonomous agent persona presets.
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isCollapsed = collapsedReasoning[index] ?? false
              return (
                <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`w-full max-w-[95%] sm:max-w-2xl rounded-2xl sm:rounded-3xl p-3 sm:p-4 text-xs shadow-md break-words ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-br-none font-medium'
                        : msg.isError
                          ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-bl-none'
                          : 'glass-card border-white/10 bg-card/80 text-foreground rounded-bl-none'
                    }`}
                  >
                    {/* Live Web Search Citations */}
                    {msg.searchSources && msg.searchSources.length > 0 && (
                      <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 space-y-1">
                        <p className="font-extrabold flex items-center gap-1.5">
                          <Globe className="size-3.5" /> Live Web Search Citations ({msg.searchSources.length} sources)
                        </p>
                        <ul className="space-y-0.5 pl-4 list-disc text-[10px] text-emerald-300/80">
                          {msg.searchSources.slice(0, 3).map((s, i) => (
                            <li key={i} className="truncate">
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="underline hover:text-emerald-200"
                              >
                                {s.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Agentic Reasoning / Thought Process Accordion */}
                    {Boolean(msg.reasoning) && (
                      <div className="mb-3 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-card/60 backdrop-blur-xl overflow-hidden shadow-lg transition-all">
                        <button
                          type="button"
                          onClick={() => toggleReasoningCollapse(index)}
                          className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center justify-between text-xs font-bold text-indigo-300 hover:bg-indigo-500/10 transition-colors gap-2"
                        >
                          <span className="flex items-center gap-1.5 sm:gap-2 truncate">
                            <span className="relative flex size-2 shrink-0">
                              {msg.isThinking && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                              )}
                              <span
                                className={`relative inline-flex rounded-full size-2 ${
                                  msg.isThinking ? 'bg-cyan-500' : 'bg-indigo-500'
                                }`}
                              />
                            </span>
                            <Brain
                              className={`size-3.5 shrink-0 text-cyan-400 ${msg.isThinking ? 'animate-pulse' : ''}`}
                            />
                            <span className="truncate">
                              {msg.isThinking
                                ? 'Agent Reasoning...'
                                : 'Agent Thought Process'}
                            </span>
                            <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/20 text-indigo-200 font-mono border border-indigo-500/30 shrink-0">
                              {msg.reasoning?.length ?? 0} chars
                            </span>
                          </span>
                          <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground font-medium shrink-0 ml-1">
                            <span>{isCollapsed ? 'Show' : 'Hide'}</span>
                            <ChevronDown
                              className={`size-3 sm:size-3.5 transition-transform duration-200 ${
                                isCollapsed ? '' : 'rotate-180'
                              }`}
                            />
                          </span>
                        </button>
                        {!isCollapsed && (
                          <div className="px-3 pb-3 pt-1 text-[11px] font-mono text-muted-foreground/90 whitespace-pre-wrap leading-relaxed border-t border-indigo-500/20 bg-black/40 custom-scrollbar max-h-80 overflow-y-auto select-text break-words">
                            {msg.reasoning}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Final Assistant Response Content */}
                    {msg.content ? (
                      <Markdown>{msg.content}</Markdown>
                    ) : msg.isThinking ? (
                      <div className="flex items-center gap-2 py-2 text-indigo-400 text-xs italic">
                        <Brain className="size-4 animate-spin text-cyan-400" />
                        <span>Synthesizing final answer from reasoning steps...</span>
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
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-2.5 sm:p-4 border-t border-border/40 bg-card/40 shrink-0">
          <div className="flex items-end sm:items-center gap-2 sm:gap-3 bg-card/60 border border-white/10 rounded-2xl p-2 focus-within:border-indigo-500/50">
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
                  ? `[${AGENT_PERSONAS[agentPersona].name}] Ask any complex task, coding problem, or reasoning inquiry...`
                  : 'Ask ApiDoct anything...'
              }
              rows={1}
              className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-foreground outline-none resize-none px-2 py-1 min-h-[38px] max-h-32"
            />
            <Button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl px-3 sm:px-4 py-2 text-xs font-bold shadow-md glow-indigo shrink-0"
            >
              <Send className="size-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
