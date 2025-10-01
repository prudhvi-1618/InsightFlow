"use client"

import React, { useState, useEffect, useRef } from "react"

interface SearchInfo {
  stages: string[]
  query: string
  urls: string[]
  error?: string
}

interface Message {
  id: number
  content: string
  isUser: boolean
  type: string
  isLoading?: boolean
  searchInfo?: SearchInfo
}

const Home = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      content: 'Hi there, how can I help you?',
      isUser: false,
      type: 'message'
    }
  ])
  const [currentMessage, setCurrentMessage] = useState("")
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (currentMessage.trim()) {
      const newMessageId = messages.length > 0 ? Math.max(...messages.map(msg => msg.id)) + 1 : 1

      setMessages(prev => [
        ...prev,
        {
          id: newMessageId,
          content: currentMessage,
          isUser: true,
          type: 'message'
        }
      ])

      const userInput = currentMessage
      setCurrentMessage("")

      try {
        const aiResponseId = newMessageId + 1
        setMessages(prev => [
          ...prev,
          {
            id: aiResponseId,
            content: "",
            isUser: false,
            type: 'message',
            isLoading: true,
            searchInfo: {
              stages: [],
              query: "",
              urls: []
            }
          }
        ])

        let url = `http://127.0.0.1:8000/chat_stream/${encodeURIComponent(userInput)}`
        if (checkpointId) {
          url += `?checkpoint_id=${encodeURIComponent(checkpointId)}`
        }

        const eventSource = new EventSource(url)
        let streamedContent = ""
        let searchData: SearchInfo | null = null

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)

            if (data.type === 'checkpoint') {
              setCheckpointId(data.checkpoint_id)
            }
            else if (data.type === 'content') {
              streamedContent += data.content
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiResponseId
                    ? { ...msg, content: streamedContent, isLoading: false }
                    : msg
                )
              )
            }
            else if (data.type === 'search_start') {
              const newSearchInfo: SearchInfo = {
                stages: ['searching'],
                query: data.query,
                urls: []
              }
              searchData = newSearchInfo
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiResponseId
                    ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: false }
                    : msg
                )
              )
            }
            else if (data.type === 'search_results') {
              try {
                const urls = typeof data.urls === 'string' ? JSON.parse(data.urls) : data.urls
                const newSearchInfo: SearchInfo = {
                  stages: searchData ? [...searchData.stages, 'reading'] : ['reading'],
                  query: searchData?.query || "",
                  urls: urls
                }
                searchData = newSearchInfo
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === aiResponseId
                      ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: false }
                      : msg
                  )
                )
              } catch (err) {
                console.error("Error parsing search results:", err)
              }
            }
            else if (data.type === 'search_error') {
              const newSearchInfo: SearchInfo = {
                stages: searchData ? [...searchData.stages, 'error'] : ['error'],
                query: searchData?.query || "",
                error: data.error,
                urls: []
              }
              searchData = newSearchInfo
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiResponseId
                    ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: false }
                    : msg
                )
              )
            }
            else if (data.type === 'end') {
              if (searchData) {
                const finalSearchInfo: SearchInfo = {
                  ...searchData,
                  stages: [...searchData.stages, 'writing']
                }
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === aiResponseId
                      ? { ...msg, searchInfo: finalSearchInfo, isLoading: false }
                      : msg
                  )
                )
              }
              eventSource.close()
            }
          } catch (error) {
            console.error("Error parsing event data:", error, event.data)
          }
        }

        eventSource.onerror = (error) => {
          console.error("EventSource error:", error)
          eventSource.close()
          if (!streamedContent) {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === aiResponseId
                  ? { ...msg, content: "Sorry, there was an error processing your request.", isLoading: false }
                  : msg
              )
            )
          }
        }

        eventSource.addEventListener('end', () => {
          eventSource.close()
        })
      } catch (error) {
        console.error("Error setting up EventSource:", error)
        setMessages(prev => [
          ...prev,
          {
            id: newMessageId + 1,
            content: "Sorry, there was an error connecting to the server.",
            isUser: false,
            type: 'message',
            isLoading: false
          }
        ])
      }
    }
  }

  return (
    <main className="min-h-[100svh] bg-background text-foreground flex flex-col">
      <header className="border-b border-border">
        <div className=" w-full  px-4 py-4 flex items-center justify-between">
          <h1 className="text-balance text-lg md:text-xl font-semibold">My Assistant</h1>
          <span className="text-xs text-muted-foreground">Conversational • Web-aware</span>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 flex flex-col gap-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>
      </section>
      <div className="m-12"></div>
      <div ref={endRef} />
      <div className="fixed bottom-0 w-full bg-card">
      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
            <ChatInput value={currentMessage} onChange={setCurrentMessage} onSubmit={handleSubmit} />
            <p className="mt-2 text-xs text-muted-foreground">
              Powered by Perplexity API with real-time web search and streaming responses.
            </p>
        </div>
      </footer>
      </div>
    </main>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const hasSearchInfo = message.searchInfo && message.searchInfo.stages.length > 0

  return (
    <div className={`flex w-full flex-col gap-2 ${message.isUser ? "items-end" : "items-start"}`}>
      {hasSearchInfo && <SearchStages searchInfo={message.searchInfo!} />}

      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm transition-all ${
          message.isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card text-card-foreground border border-border rounded-bl-sm"
        }`}
      >
        {message.isLoading && !message.content ? (
          <div className="flex items-center gap-2">
            <Dots />
            <span className="text-sm text-muted-foreground">Thinking…</span>
          </div>
        ) : (
          <p className="text-pretty leading-relaxed whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
    </div>
  )
}

function SearchStages({ searchInfo }: { searchInfo: SearchInfo }) {
  const { stages, query, urls, error } = searchInfo

  return (
    <div className="w-full max-w-[85%] flex flex-col gap-2">
      {query && (
        <div className="bg-card/50 border border-border rounded-xl px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Searching for: <span className="text-foreground font-medium">{query}</span>
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {stages.includes("searching") && (
          <div className="bg-card border border-border rounded-lg px-3 py-1.5 flex items-center gap-2">
            {/* <Spinner /> */}
            <span className="text-xs">Searching…</span>
          </div>
        )}
        {stages.includes("reading") && (
          <div className="bg-card border border-border rounded-lg px-3 py-1.5 flex items-center gap-2">
            {/* <Spinner /> */}
            <span className="text-xs">Reading sources…</span>
          </div>
        )}
        {stages.includes("writing") && (
          <div className="bg-card border border-border rounded-lg px-3 py-1.5 flex items-center gap-2">
            <CheckIcon />
            <span className="text-xs">Complete</span>
          </div>
        )}
        {stages.includes("error") && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="text-xs text-destructive">Search error</span>
          </div>
        )}
      </div>

      {urls && urls.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-xs font-medium mb-2">Sources:</p>
          <ul className="flex flex-col gap-1.5">
            {urls.slice(0, 5).map((url, i) => (
              <li key={i}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline truncate block"
                >
                  {i + 1}. {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}

function Dots() {
  return (
    <div className="flex items-center gap-1">
      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.2s]" />
      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.1s]" />
      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
    </div>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-3 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin"
    />
  )
}

function CheckIcon() {
  return (
    <svg className="size-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function ChatInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <label className="sr-only" htmlFor="chat-input">
        Type your message
      </label>
      <input
        id="chat-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask me anything…"
        className="flex-1 rounded-xl border border-border bg-secondary/40 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
        autoComplete="off"
      />
      <button
        type="submit"
        className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
      >
        Send
      </button>
    </form>
  )
}

export default Home