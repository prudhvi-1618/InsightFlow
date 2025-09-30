import { NextResponse } from "next/server"

type SearchResult = {
  url: string
  title: string
  snippet: string
  favicon?: string
}

export async function POST(req: Request) {
  const { query } = (await req.json()) as { query: string }

  const key = process.env.TAVILY_API_KEY
  if (key) {
    try {
      const tavily = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // If your Tavily account expects Authorization header instead, move the key there.
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: "basic",
          max_results: 5,
          include_answer: false,
          include_images: false,
          include_domains: [],
        }),
      })

      if (!tavily.ok) {
        throw new Error(`Tavily error ${tavily.status}`)
      }

      const data = await tavily.json()
      const results: SearchResult[] = (data.results || []).map((r: any) => ({
        url: r.url,
        title: r.title,
        snippet: r.content,
      }))
      return NextResponse.json({ results })
    } catch (e) {
      // fall back to mock on error
      console.log("[v0] Tavily search error, returning mock:", (e as Error).message)
    }
  }

  // Mock results fallback for demos without API keys
  const mock: SearchResult[] = [
    {
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
      title: `Wikipedia: ${query}`,
      snippet: `Encyclopedic overview and references related to "${query}".`,
    },
    {
      url: `https://www.example.com/search?q=${encodeURIComponent(query)}`,
      title: `Example.com results for ${query}`,
      snippet: "Curated links and resources relevant to your query. Click through to explore more.",
    },
    {
      url: `https://news.ycombinator.com/`,
      title: `Hacker News discussions`,
      snippet: `Community discussions that may include topics about "${query}".`,
    },
    {
      url: `https://www.nature.com/search?q=${encodeURIComponent(query)}`,
      title: `Nature: Research related to ${query}`,
      snippet: "Peer-reviewed articles and scientific coverage.",
    },
    {
      url: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`,
      title: `Reddit: ${query}`,
      snippet: "Community threads and opinions around the topic.",
    },
  ]

  return NextResponse.json({ results: mock })
}
