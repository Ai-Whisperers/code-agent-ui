import { useState, useRef, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import DOMPurify from 'dompurify'
import mermaid from 'mermaid'

// Initialize mermaid once at module level.
//
// htmlLabels defaults to true in Mermaid, which causes node labels to be rendered
// inside <foreignObject> HTML elements. DOMPurify's SVG profile strips the HTML
// content inside <foreignObject> (div, span, p …) because those tags are not valid
// SVG — producing empty boxes with no text while leaving the shapes intact.
// Sequence diagrams were unaffected because they use plain SVG <text> elements.
//
// Setting htmlLabels: false for every diagram type that supports it forces Mermaid
// to use SVG <text>/<tspan> elements for all labels, which DOMPurify preserves.
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
  suppressErrorRendering: true,
  flowchart: { htmlLabels: false },
  classDiagram: { htmlLabels: false },
  stateDiagram: { htmlLabels: false },
} as Parameters<typeof mermaid.initialize>[0])

export function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState('')
  const [renderError, setRenderError] = useState(false)
  // Tracks which render call is the most recent to discard stale results
  const renderIdRef = useRef(0)

  useEffect(() => {
    const renderId = ++renderIdRef.current

    // Use two distinct UUIDs: one for the mermaid render call, one for the
    // displayed SVG element. After rendering, replace every occurrence of the
    // render ID with the display ID throughout the SVG string (the id=""
    // attribute on <svg> AND all matching #id CSS selectors inside <style>).
    // This keeps the scoped CSS rules intact (so node fills/colours work) while
    // ensuring mermaid will never find and remove the displayed element on a
    // future render() call.
    const rendererKey = `rnd${crypto.randomUUID().replace(/-/g, '')}`
    const displayKey = `dsp${crypto.randomUUID().replace(/-/g, '')}`

    mermaid
      .render(rendererKey, code)
      .then(({ svg: rawSvg }) => {
        if (renderId !== renderIdRef.current) return
        const renamed = rawSvg.replaceAll(rendererKey, displayKey)
        setSvg(DOMPurify.sanitize(renamed, { USE_PROFILES: { svg: true, svgFilters: true } }))
        setRenderError(false)
      })
      .catch(() => {
        if (renderId !== renderIdRef.current) return
        setRenderError(true)
      })
  }, [code])

  if (renderError) {
    return (
      <div className="my-4 flex items-center gap-2 px-4 py-3 rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] text-[var(--color-fonts-font-color-support)] text-sm">
        <AlertTriangle size={15} />
        Failed to render diagram.
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="my-4 h-32 rounded-[var(--border-radius-card)] bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] animate-pulse" />
    )
  }

  return (
    <div
      dangerouslySetInnerHTML={{ __html: svg }}
      className="my-4 flex justify-center overflow-x-auto rounded-[var(--border-radius-card)] bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] p-4"
    />
  )
}
