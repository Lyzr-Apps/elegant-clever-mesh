'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useRef } from 'react'
import { Settings, Send, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// Disable static generation for this page since it uses client-side state
export const dynamic = 'force-dynamic'

const AGENT_ID = '6921973e23b88b385103d189'

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  type?: string
  emotional_themes_detected?: string[]
  crisis_detected?: boolean
}

interface ConversationSession {
  messages: Message[]
  lastUpdated: Date
  sessionId: string
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [userId, setUserId] = useState('')
  const [preserveHistory, setPreserveHistory] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Initialize session and load conversation history
  useEffect(() => {
    const newSessionId = `session-${Date.now()}`
    const newUserId = `user-${Date.now()}`
    setSessionId(newSessionId)
    setUserId(newUserId)

    // Load saved conversations if enabled
    const saved = localStorage.getItem('abyss_conversations')
    const settings = localStorage.getItem('abyss_settings')

    if (settings) {
      const parsedSettings = JSON.parse(settings)
      setPreserveHistory(parsedSettings.preserveHistory !== false)
      setTheme(parsedSettings.theme || 'dark')
    }

    if (saved && preserveHistory) {
      try {
        const conversations: ConversationSession[] = JSON.parse(saved)
        if (conversations.length > 0) {
          const latestConversation = conversations[conversations.length - 1]
          setMessages(latestConversation.messages)
        }
      } catch (e) {
        console.error('Failed to load conversation history:', e)
      }
    }

    // Load greeting if first time
    if (!saved || !preserveHistory) {
      setMessages([
        {
          id: `msg-${Date.now()}`,
          role: 'agent',
          content:
            "Hello. I'm here to listen and understand what's on your mind. This is a judgment-free space where you can share whatever feels important to you right now. What's been weighing on you?",
          timestamp: new Date(),
          type: 'empathetic_reflection',
        },
      ])
    }
  }, [])

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  // Save conversation history
  const saveConversation = () => {
    if (!preserveHistory) return

    try {
      const saved = localStorage.getItem('abyss_conversations')
      const conversations: ConversationSession[] = saved ? JSON.parse(saved) : []

      conversations.push({
        messages,
        lastUpdated: new Date(),
        sessionId,
      })

      localStorage.setItem('abyss_conversations', JSON.stringify(conversations))
    } catch (e) {
      console.error('Failed to save conversation:', e)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim()) return

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
      type: 'user_input',
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          agent_id: AGENT_ID,
          user_id: userId,
          session_id: sessionId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Extract therapeutic response from parsed data
        const therapyData =
          typeof data.response === 'object' && data.response !== null
            ? data.response
            : { therapeutic_response: data.response }

        const therapyResponse = therapyData.therapeutic_response || String(data.response)
        const responseType = therapyData.response_type || 'empathetic_reflection'
        const emotionalThemes = therapyData.emotional_themes_detected || []
        const crisisDetected = therapyData.crisis_detected || false

        const agentMessage: Message = {
          id: `msg-${Date.now()}`,
          role: 'agent',
          content: therapyResponse,
          timestamp: new Date(),
          type: responseType,
          emotional_themes_detected: emotionalThemes,
          crisis_detected: crisisDetected,
        }

        setMessages((prev) => [...prev, agentMessage])

        // Save conversation
        saveConversation()
      } else {
        const errorMessage: Message = {
          id: `msg-${Date.now()}`,
          role: 'agent',
          content:
            "I apologize, but I'm having difficulty processing that at the moment. Please try again, or if you're in crisis, please reach out to a mental health professional immediately.",
          timestamp: new Date(),
          type: 'error',
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'agent',
        content:
          "I'm experiencing a technical issue. Your feelings matter - please reach out to a trusted person or crisis service if you need immediate support.",
        timestamp: new Date(),
        type: 'error',
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const clearAllData = () => {
    if (
      window.confirm(
        'Are you sure you want to permanently delete all conversation history? This cannot be undone.'
      )
    ) {
      localStorage.removeItem('abyss_conversations')
      setMessages([
        {
          id: `msg-${Date.now()}`,
          role: 'agent',
          content:
            "All conversations have been cleared. This is a fresh start. What's on your mind today?",
          timestamp: new Date(),
          type: 'empathetic_reflection',
        },
      ])
      saveConversation()
    }
  }

  const exportConversations = () => {
    try {
      const saved = localStorage.getItem('abyss_conversations')
      if (!saved) {
        alert('No conversations to export.')
        return
      }

      const dataStr = JSON.stringify(JSON.parse(saved), null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `abyss-conversations-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed:', e)
      alert('Failed to export conversations.')
    }
  }

  const isDark = theme === 'dark'
  const bgClass = isDark ? 'bg-gradient-to-b from-slate-950 to-slate-900' : 'bg-gradient-to-b from-slate-50 to-slate-100'
  const textClass = isDark ? 'text-slate-100' : 'text-slate-900'
  const cardClass = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
  const inputClass = isDark
    ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500'
    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'

  return (
    <div className={`min-h-screen ${bgClass} flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className={`border-b ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/50'} backdrop-blur-sm px-4 py-4`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className={`text-2xl font-light tracking-tight ${textClass}`}>Abyss</h1>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-200'}`}
          >
            {showSettings ? (
              <X className={`w-5 h-5 ${textClass}`} />
            ) : (
              <Settings className={`w-5 h-5 ${textClass}`} />
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 p-4 max-w-6xl mx-auto w-full overflow-hidden">
        {/* Chat Area */}
        <div className={`flex-1 flex flex-col rounded-lg ${cardClass} border overflow-hidden`}>
          {/* Messages */}
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6 pr-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Loading conversation...
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md xl:max-w-lg px-5 py-4 rounded-lg animate-in fade-in duration-300 ${
                        msg.role === 'user'
                          ? isDark
                            ? 'bg-blue-900/60 border border-blue-800'
                            : 'bg-blue-100 border border-blue-200'
                          : isDark
                            ? 'bg-slate-800 border border-slate-700'
                            : 'bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <p className={`text-sm leading-relaxed ${textClass}`}>{msg.content}</p>
                      <p
                        className={`text-xs mt-2 opacity-50 ${textClass}`}
                      >
                        {msg.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>

                      {msg.emotional_themes_detected && msg.emotional_themes_detected.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {msg.emotional_themes_detected.map((theme, idx) => (
                            <span
                              key={idx}
                              className={`text-xs px-2 py-1 rounded-full ${
                                isDark
                                  ? 'bg-slate-700 text-slate-300'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {theme}
                            </span>
                          ))}
                        </div>
                      )}

                      {msg.crisis_detected && (
                        <div className={`mt-3 p-2 rounded ${isDark ? 'bg-red-900/30 border border-red-800' : 'bg-red-100 border border-red-300'}`}>
                          <p className="text-xs text-red-500 font-medium">
                            Crisis resources available - please reach out for support
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className={`border-t ${isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-white/30'} p-4`}>
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(e as any)
                  }
                }}
                placeholder="Share what's on your mind..."
                className={`flex-1 p-3 rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${inputClass}`}
                rows={1}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className={`w-80 rounded-lg ${cardClass} border p-6 overflow-y-auto`}>
            <h2 className={`text-lg font-semibold mb-6 ${textClass}`}>Settings</h2>

            <div className="space-y-6">
              {/* Conversation History */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    id="preserve-history"
                    checked={preserveHistory}
                    onChange={(e) => {
                      setPreserveHistory(e.target.checked)
                      localStorage.setItem(
                        'abyss_settings',
                        JSON.stringify({ preserveHistory: e.target.checked, theme })
                      )
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="preserve-history" className={`text-sm font-medium cursor-pointer ${textClass}`}>
                    Save conversations
                  </label>
                </div>
                <p className={`text-xs ml-7 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Your conversations are encrypted and stored locally
                </p>
              </div>

              <Separator className={isDark ? 'bg-slate-700' : 'bg-slate-300'} />

              {/* Theme */}
              <div>
                <label className={`text-sm font-medium block mb-3 ${textClass}`}>Theme</label>
                <div className="flex gap-2">
                  {['dark', 'light'].map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTheme(t as 'dark' | 'light')
                        localStorage.setItem(
                          'abyss_settings',
                          JSON.stringify({ preserveHistory, theme: t })
                        )
                      }}
                      className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors capitalize ${
                        theme === t
                          ? 'bg-blue-600 text-white'
                          : isDark
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <Separator className={isDark ? 'bg-slate-700' : 'bg-slate-300'} />

              {/* Data Management */}
              <div>
                <label className={`text-sm font-medium block mb-3 ${textClass}`}>Data Management</label>
                <div className="space-y-2">
                  <Button
                    onClick={exportConversations}
                    variant="outline"
                    className="w-full text-sm"
                  >
                    Export Conversations
                  </Button>
                  <Button
                    onClick={clearAllData}
                    variant="destructive"
                    className="w-full text-sm"
                  >
                    Delete All Data
                  </Button>
                </div>
              </div>

              <Separator className={isDark ? 'bg-slate-700' : 'bg-slate-300'} />

              {/* Crisis Resources */}
              <div>
                <label className={`text-sm font-medium block mb-3 ${textClass}`}>Crisis Resources</label>
                <div className={`text-xs space-y-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  <p>
                    <strong>National Suicide Prevention Lifeline:</strong>{' '}
                    <a
                      href="tel:988"
                      className="text-blue-500 hover:underline"
                    >
                      988
                    </a>
                  </p>
                  <p>
                    <strong>Crisis Text Line:</strong> Text HOME to{' '}
                    <a href="sms:741741" className="text-blue-500 hover:underline">
                      741741
                    </a>
                  </p>
                  <p>
                    <strong>International:</strong>{' '}
                    <a
                      href="https://findahelpline.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      findahelpline.com
                    </a>
                  </p>
                </div>
              </div>

              <Separator className={isDark ? 'bg-slate-700' : 'bg-slate-300'} />

              {/* About */}
              <div>
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  Abyss is an AI-powered therapeutic companion. For immediate crisis support, please contact emergency services or the resources above.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
