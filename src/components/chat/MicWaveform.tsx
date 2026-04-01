import { useEffect, useRef } from 'react'

const BAR_COUNT = 5
const BAR_MIN_H = 3   // px
const BAR_MAX_H = 20  // px

type Props = { active: boolean }

/**
 * Animated waveform indicator shown while dictation is active.
 * Driven by a sine-wave animation — no getUserMedia / AudioContext so it
 * does not compete with SpeechRecognition for the microphone.
 */
export function MicWaveform({ active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!active) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    let stopped = false

    const draw = () => {
      if (stopped) return
      const t = Date.now() / 250
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const gap = 3
      const barW = (canvas.width - gap * (BAR_COUNT - 1)) / BAR_COUNT
      for (let i = 0; i < BAR_COUNT; i++) {
        const h = BAR_MIN_H + (BAR_MAX_H - BAR_MIN_H) * 0.5 * (1 + Math.sin(t + i * 1.1))
        const x = i * (barW + gap)
        const y = (canvas.height - h) / 2
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.roundRect(x, y, barW, h, 2)
        ctx.fill()
      }
      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      stopped = true
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      width={BAR_COUNT * 5 + (BAR_COUNT - 1) * 3}
      height={BAR_MAX_H}
      className="block"
      aria-hidden
    />
  )
}
