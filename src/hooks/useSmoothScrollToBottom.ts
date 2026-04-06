import { useCallback, useEffect, useRef } from 'react'

/**
 * Drives a smooth scroll-to-bottom animation on a scrollable container using
 * a continuous lerp (ease-out) RAF loop rather than CSS scroll-behavior or
 * the Web Scroll API.
 *
 * Why not CSS scroll-behavior:smooth?
 *   Setting `scrollTop` repeatedly while a CSS smooth-scroll animation is
 *   already running restarts the animation from the current position on every
 *   assignment. At token-arrival frequency this produces a series of tiny,
 *   overlapping micro-animations that look like a stutter.
 *
 * Why not scrollTo({ behavior:'smooth' })?
 *   Same issue — each call creates a new JS-driven animation that competes
 *   with the previous one.
 *
 * This hook keeps ONE RAF loop alive for the duration of a stream.
 * Each frame the loop reads the latest scrollHeight and lerps scrollTop
 * toward it, so growing content is tracked smoothly without any restarts.
 *
 * Lerp factor 0.25 at 60 fps ≈ visually at target within ~150 ms for any
 * gap size, with a natural ease-out deceleration as it closes in.
 */

const LERP = 0.25
const STOP_THRESHOLD = 0.5 // px — below this the loop terminates

export function useSmoothScrollToBottom(
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const rafRef = useRef<number | null>(null)

  /**
   * Start (or continue) the lerp loop. Safe to call on every token update —
   * if the loop is already running this is a cheap no-op; the in-flight loop
   * will naturally read the updated scrollHeight on its next frame.
   */
  const scrollToBottom = useCallback(() => {
    if (rafRef.current !== null) return

    const step = () => {
      const el = containerRef.current
      if (!el) {
        rafRef.current = null
        return
      }

      const target = el.scrollHeight - el.clientHeight
      const diff = target - el.scrollTop

      if (Math.abs(diff) < STOP_THRESHOLD) {
        el.scrollTop = target
        rafRef.current = null
        return
      }

      el.scrollTop += diff * LERP
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
  }, [containerRef])

  /** Stop the loop (e.g. when the user scrolls away or streaming ends). */
  const cancelScroll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  useEffect(() => () => cancelScroll(), [cancelScroll])

  return { scrollToBottom, cancelScroll }
}
