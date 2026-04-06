import type { ThinkingStep, WebSource } from '@/types/api'

/**
 * Parses the formatted output from WebSearchTool.java into structured WebSource objects.
 *
 * Expected format:
 *   === WEB SEARCH RESULTS — UNTRUSTED EXTERNAL CONTENT ===
 *   Query: <query>
 *
 *   Summary: <optional summary>
 *
 *   1. **<title>**
 *      URL: <url>
 *      <snippet>
 *
 *   2. **<title>**
 *   ...
 *   === END OF WEB SEARCH RESULTS ===
 */
export function parseWebSearchResult(result: string): WebSource[] {
  const sources: WebSource[] = []

  // Extract query
  const queryMatch = result.match(/^Query:\s*(.+)$/m)
  const query = queryMatch?.[1]?.trim()

  // Split on numbered result blocks: "1. **title**"
  // Use a lookahead so the delimiter itself is kept in the split chunks
  const blocks = result.split(/(?=\n\d+\.\s+\*\*)/)

  for (const block of blocks) {
    const titleMatch = block.match(/^\n?\d+\.\s+\*\*(.+?)\*\*/)
    if (!titleMatch) continue

    const title = titleMatch[1].trim()

    const urlMatch = block.match(/URL:\s*(\S+)/)
    if (!urlMatch) continue
    const url = urlMatch[1].trim()

    // Snippet: everything after the URL line, trimmed and de-indented
    const afterUrl = block.slice(block.indexOf(urlMatch[0]) + urlMatch[0].length)
    const snippet = afterUrl
      .split('\n')
      .map((l) => l.replace(/^\s{3}/, '')) // remove 3-space indent
      .join('\n')
      .trim()
      .replace(/\n=== END.*/, '') // strip trailing marker if present

    sources.push({ title, url, snippet: snippet || undefined, query })
  }

  return sources
}

/**
 * Extracts all WebSource objects from the thinking steps of a completed assistant message.
 * Collects results from every completed web_search tool call (there may be multiple)
 * and deduplicates by URL so the stored array is already canonical.
 */
export function extractWebSources(steps: ThinkingStep[]): WebSource[] {
  const sources: WebSource[] = []
  for (const step of steps) {
    if (step.kind === 'tool' && step.name === 'web_search' && step.status === 'completed' && step.result) {
      sources.push(...parseWebSearchResult(step.result))
    }
  }
  // Deduplicate by URL — keep first occurrence
  const seen = new Set<string>()
  return sources.filter((s) => {
    if (seen.has(s.url)) return false
    seen.add(s.url)
    return true
  })
}

/** Returns a best-effort hostname label for display (strips www.). */
export function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Google S2 favicon URL — works for most public domains. */
export function faviconUrl(url: string): string {
  const domain = sourceDomain(url)
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
}
