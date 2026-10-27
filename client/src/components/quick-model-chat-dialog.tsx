import { useState, useRef, useEffect } from 'react'
import {
  MessageSquare,
  Send,
  Zap,
  Sparkles,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  KeyRound,
} from 'lucide-react'
import { Dialog, DialogClose, DialogPopup, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/markdown'
import { apiFetch } from '@/lib/api'
import type { Row } from '@/lib/routing'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  latencyMs?: number
  isError?: boolean
}

export function QuickModelChatDialog({
  model,
  open,
  onOpenChange,
}: {
  model: Row | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pingResult, setPingResult] = useState<string | null>(null)
  const [pingLoading, setPingLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && model) {
      setMessages([
        {
          role: 'assistant',
          content: `👋 Hello! I am **${model.displayName}** on **${model.platform}**.\n\nAsk me anything, or click a quick prompt below to test my response, coding, or reasoning!`,
        },
      ])
      setPingResult(null)
    }
  }, [open, model?.modelDbId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  if (!model) return null

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim()
    if (!text || loading) return

    const newMsgs: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)

    const startTime = Date.now()
    try {
      const res = await apiFetch<{
        choices?: Array<{ message?: { content?: string } }>
        error?: { message?: string }
      }>('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: model.canonicalId || model.modelId,
          messages: newMsgs.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: 1000,
          temperature: 0.7,
        }),
      })

      const latencyMs = Date.now() - startTime
      const reply = res.choices?.[0]?.message?.content || res.error?.message || '(No response received)'
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: reply,
          latencyMs,
          isError: Boolean(res.error),
        },
      ])
    } catch (err: any) {
      const latencyMs = Date.now() - startTime
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Request Error:** ${err?.message || 'Failed to complete chat request'}`,
          latencyMs,
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handlePing = async () => {
    setPingLoading(true)
    setPingResult(null)
    try {
      const res = await apiFetch<any>('/api/models/test', {
        method: 'POST',
        body: JSON.stringify({
          modelDbId: model.modelDbId,
          platform: model.platform,
          modelId: model.modelId,
          prompt: 'Say "ApiDoct OK" in 3 words.',
        }),
      })
      if (res.success) {
        setPingResult(`✅ Live OK (${res.latencyMs}ms): "${res.content}"`)
      } else {
        setPingResult(`⚠️ ${res.status || 'Error'}: ${res.error || 'Failed'}`)
      }
    } catch (err: any) {
      setPingResult(`❌ Error: ${err.message}`)
    } finally {
      setPingLoading(false)
    }
  }

  const quickPrompts = [
    '✨ Introduce yourself in 2 sentences',
    '⚡ Write a Python function for Fibonacci',
    '🧠 What is 25 * 48? Show steps',
    '🎨 Create a modern HTML+CSS button snippet',
  ]

  const keyCount = model.keyCount ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup maxWidth="max-w-2xl">
        <div className="flex flex-col h-[75vh] max-h-[700px] min-h-[450px]">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/40 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
                <MessageSquare className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base font-extrabold truncate">
                    {model.displayName}
                  </DialogTitle>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    {model.platform}
                  </span>
                  {keyCount > 0 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                      <KeyRound className="size-3" /> {keyCount} Key{keyCount > 1 ? 's' : ''} Ready
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                      <AlertTriangle className="size-3" /> No Key
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                  {model.modelId} • {model.monthlyTokenBudget || 'Quota Active'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePing}
                disabled={pingLoading}
                className="h-7 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10 px-2.5"
                title="Test live model responsiveness"
              >
                {pingLoading ? (
                  <Loader2 className="size-3 animate-spin mr-1 text-amber-400" />
                ) : (
                  <Zap className="size-3 mr-1 text-amber-400" />
                )}
                <span>Ping</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMessages([])}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400"
                title="Clear chat"
              >
                <Trash2 className="size-3.5" />
              </Button>

              <DialogClose className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </DialogClose>
            </div>
          </div>

          {/* Live Ping Banner if triggered */}
          {pingResult && (
            <div className="py-1.5 px-3 bg-accent/30 border-b border-border/30 text-xs font-mono flex items-center justify-between shrink-0">
              <span className="truncate">{pingResult}</span>
              <button
                onClick={() => setPingResult(null)}
                className="text-[10px] text-muted-foreground hover:text-foreground ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="size-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-600 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Sparkles className="size-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-br-none shadow-md font-medium'
                      : msg.isError
                      ? 'bg-rose-950/40 border border-rose-500/30 text-rose-200 rounded-bl-none shadow'
                      : 'bg-card/75 border border-white/10 text-foreground rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <Markdown>{msg.content}</Markdown>
                  )}

                  {msg.latencyMs !== undefined && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 font-mono mt-1 pt-1 border-t border-border/20">
                      <Zap className="size-2.5 text-cyan-400" />
                      <span>{msg.latencyMs}ms</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 justify-start">
                <div className="size-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-600 flex items-center justify-center text-white shrink-0 animate-pulse">
                  <Sparkles className="size-3.5" />
                </div>
                <div className="p-3 rounded-2xl bg-card/60 border border-white/10 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin text-indigo-400" />
                  <span>{model.displayName} is generating response...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Chips */}
          <div className="flex gap-1.5 overflow-x-auto py-2 px-1 no-scrollbar shrink-0 border-t border-border/30">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => handleSend(p)}
                className="text-[11px] px-2.5 py-1 rounded-xl bg-accent/40 hover:bg-accent/80 border border-border/40 text-muted-foreground hover:text-foreground whitespace-nowrap transition-all shrink-0"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="pt-2 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-center gap-2 p-1.5 rounded-2xl bg-card/80 border border-white/10 shadow-lg focus-within:border-indigo-500/50 transition-all"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={`Message ${model.displayName}... (Enter to send)`}
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent border-0 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none resize-none max-h-24"
              />

              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || loading}
                className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-xl size-8 p-0 shrink-0 shadow-md transition-all disabled:opacity-40"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              </Button>
            </form>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
