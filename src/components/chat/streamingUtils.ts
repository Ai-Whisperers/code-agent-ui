/**
 * Placeholder injected into the markdown content when a special code block
 * (mermaid, chart, chartjs, or a Chart.js-shaped js/json block) is still
 * open (streaming in-progress). react-markdown will call the custom `code`
 * renderer with this exact string so we can swap it for a spinner.
 */
export const DIAGRAM_LOADING_PLACEHOLDER = '__diagram_loading__'

const SPECIAL_LANG_RE = /^(mermaid|chart|chartjs)$/i
const JS_JSON_LANG_RE = /^(javascript|js|json)$/i
const CHART_TYPE_RE = /\btype\s*[:=]\s*['"`]?(bar|line|pie|doughnut|radar|polarArea)\b/i
const CHART_DATASETS_RE = /\bdatasets\s*[:[]/

/**
 * Returns true if the language tag plus partial body looks like a Chart.js
 * config that we should protect during streaming.
 */
function isChartLike(lang: string, partialBody: string): boolean {
  if (SPECIAL_LANG_RE.test(lang)) return true
  if (JS_JSON_LANG_RE.test(lang)) {
    return CHART_TYPE_RE.test(partialBody) && CHART_DATASETS_RE.test(partialBody)
  }
  return false
}

/**
 * Scans `content` line-by-line for unclosed special code fences.
 *
 * - Fully closed blocks are left untouched so MermaidDiagram / ChartBlock
 *   receive valid, complete code strings.
 * - An open block (opening fence with no matching closing fence) is replaced
 *   with a single fenced block containing DIAGRAM_LOADING_PLACEHOLDER so the
 *   custom markdown renderer can show a spinner instead of calling mermaid.render()
 *   with broken syntax.
 *
 * Regular (non-special) incomplete code fences are also closed with a bare
 * ``` so react-markdown never sees truly un-terminated fences, which avoids
 * the parser treating the rest of the document as code.
 */
export function patchStreamingContent(content: string): string {
  const lines = content.split('\n')
  const out: string[] = []

  let inFence = false
  let fenceLang = ''
  let fenceBody: string[] = []
  let fenceOpener = ''

  for (const line of lines) {
    if (!inFence) {
      // Opening fence: ``` or ~~~, optionally with a language tag
      const openMatch = /^(`{3,}|~{3,})\s*(\S*)/.exec(line)
      if (openMatch) {
        inFence = true
        fenceOpener = openMatch[1]  // the backtick/tilde sequence
        fenceLang = openMatch[2] ?? ''
        fenceBody = []
        out.push(line)
      } else {
        out.push(line)
      }
    } else {
      // Closing fence: same or longer fence marker, nothing else on the line
      const closeMatch = new RegExp(`^${fenceOpener[0]}{${fenceOpener.length},}\\s*$`).exec(line)
      if (closeMatch) {
        out.push(line)
        inFence = false
        fenceLang = ''
        fenceBody = []
        fenceOpener = ''
      } else {
        fenceBody.push(line)
        out.push(line)
      }
    }
  }

  // If we exited the loop still inside a fence, the block is open.
  if (inFence) {
    const partialBody = fenceBody.join('\n')

    if (isChartLike(fenceLang, partialBody)) {
      // Remove everything from the opening fence onward and replace with the
      // loading placeholder block so the diagram renderer isn't invoked.
      const openFenceIndex = out.length - fenceBody.length - 1
      out.splice(openFenceIndex, out.length - openFenceIndex)
      out.push(`\`\`\`${fenceLang}`)
      out.push(DIAGRAM_LOADING_PLACEHOLDER)
      out.push('```')
    } else {
      // Close any other open fence so react-markdown parses the rest of the
      // document normally.
      out.push(fenceOpener)
    }
  }

  return out.join('\n')
}
