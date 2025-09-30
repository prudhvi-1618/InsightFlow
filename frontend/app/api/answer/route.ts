import { NextResponse } from "next/server"
import { generateText } from "ai"

type SearchResult = {
  url: string
  title: string
  snippet: string
}

type Message = {
  role: "user" | "assistant"
  content: string
}

export async function POST(req: Request) {
  const { query, results, history } = (await req.json()) as {
    query: string
    results: SearchResult[]
    history: Message[]
  }

  const contextBlock =
    results && results.length
      ? results
          .slice(0, 5)
          .map((r, i) => `(${i + 1}) ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`)
          .join("\n\n")
      : "No search results available."

  const convoBlock = history
    ?.slice(-8)
    ?.map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n")

  const systemPreamble =
    `You are a concise, helpful assistant with a witty, Grok-like tone when appropriate. ` +
    `Use the provided web results to answer the user's query. ` +
    `Cite with plain language ("According to …") and avoid fabricating URLs. ` +
    `If uncertain, say so briefly.`

  const prompt =
    `${systemPreamble}\n\n` +
    `Conversation so far:\n${convoBlock || "N/A"}\n\n` +
    `User query: ${query}\n\n` +
    `Web results:\n${contextBlock}\n\n` +
    `Write a helpful answer (3-8 sentences).`

  const { text } = await generateText({
    model: "xai/grok-4",
    prompt,
  })

  return NextResponse.json({ text })
}
