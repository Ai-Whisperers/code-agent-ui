import { useCallback, useEffect, useRef, useState } from 'react'

/** TS lib.dom includes result types but not the recognition constructor; keep local minimal types. */
type SpeechRecognitionCtor = new () => WebSpeechRecognition

interface WebSpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((ev: WebSpeechRecognitionResultEvent) => void) | null
  onerror: ((ev: WebSpeechRecognitionErrorEvent) => void) | null
  onend: ((ev: Event) => void) | null
  onstart: ((ev: Event) => void) | null
}

interface WebSpeechRecognitionResultEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

/** error codes: aborted, no-speech, not-allowed, etc. */
interface WebSpeechRecognitionErrorEvent extends Event {
  readonly error: string
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export type SpeechDictationOptions = {
  /** Fired while the engine is refining text (live preview). */
  onInterim?: (transcript: string) => void
}

/**
 * Click-to-dictate using the browser Web Speech API (Chrome/Edge/Safari).
 * First click starts; second click stops.
 *
 * The browser's SpeechRecognition silently ends the session after a few
 * seconds of silence even with continuous:true. We auto-restart whenever
 * onend fires while the user hasn't explicitly stopped (wantListeningRef).
 *
 * createSessionRef holds the latest createSession function so onend can
 * call it without a circular useCallback dependency.
 */
export function useSpeechDictation(onResult: (transcript: string) => void, options?: SpeechDictationOptions) {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<WebSpeechRecognition | null>(null)
  const onResultRef = useRef(onResult)
  const onInterimRef = useRef(options?.onInterim)
  const hasStartedRef = useRef(false)
  /** True while the user wants dictation running; cleared only by stopListening(). */
  const wantListeningRef = useRef(false)
  /** Stable ref to createSession so onend can restart without a dep cycle. */
  const createSessionRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    onInterimRef.current = options?.onInterim
  }, [options?.onInterim])

  const isSupported = getSpeechRecognitionCtor() !== null

  const createSession = useCallback(() => {
    const SR = getSpeechRecognitionCtor()
    if (!SR) return

    hasStartedRef.current = false

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'

    recognition.onstart = () => {
      hasStartedRef.current = true
      setIsListening(true)
    }

    recognition.onresult = (event: WebSpeechRecognitionResultEvent) => {
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        if (!event.results[i].isFinal) {
          interim += event.results[i][0].transcript
        }
      }
      onInterimRef.current?.(interim.trim())

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue
        const t = event.results[i][0].transcript.trim()
        if (t) onResultRef.current(t)
      }
    }

    recognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wantListeningRef.current = false
        onInterimRef.current?.('')
        setIsListening(false)
      }
      // other errors (no-speech, network, aborted) are handled by onend
    }

    recognition.onend = () => {
      hasStartedRef.current = false
      recognitionRef.current = null

      if (wantListeningRef.current) {
        // Browser timed out due to silence — restart with a fresh session via ref
        onInterimRef.current?.('')
        createSessionRef.current()
      } else {
        onInterimRef.current?.('')
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      wantListeningRef.current = false
      setIsListening(false)
      recognitionRef.current = null
    }
  }, [])

  // Keep the ref in sync with the stable callback (must be in an effect, not render)
  useEffect(() => {
    createSessionRef.current = createSession
  }, [createSession])

  const startListening = useCallback(() => {
    if (recognitionRef.current) return
    wantListeningRef.current = true
    onInterimRef.current?.('')
    createSession()
  }, [createSession])

  const stopListening = useCallback(() => {
    wantListeningRef.current = false
    const r = recognitionRef.current
    if (!r) return
    try {
      if (hasStartedRef.current) r.stop()
      else r.abort()
    } catch {
      /* already stopped */
    }
  }, [])

  /** Prefer this over branching on `isListening` — ref is set before onstart. */
  const toggleListening = useCallback(() => {
    if (recognitionRef.current || wantListeningRef.current) stopListening()
    else startListening()
  }, [startListening, stopListening])

  useEffect(() => {
    return () => {
      wantListeningRef.current = false
      const r = recognitionRef.current
      if (r) {
        try { r.abort() } catch { /* ignore */ }
      }
    }
  }, [])

  return { isListening, isSupported, startListening, stopListening, toggleListening }
}
