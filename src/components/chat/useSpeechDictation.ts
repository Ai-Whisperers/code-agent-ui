import { useCallback, useEffect, useRef, useState } from 'react'
import { getToken } from '@/lib/keycloak'

export type SpeechDictationOptions = {
  /** Called after each silence-delimited chunk is transcribed. */
  onChunkTranscribed?: (transcript: string) => void
}

/**
 * MediaRecorder + energy-threshold VAD dictation.
 *
 * Flow:
 *   click start → getUserMedia → MediaRecorder + AnalyserNode (read-only VAD)
 *   on silence (RMS < threshold for SILENCE_MS) → stop chunk → POST to /api/speech/transcribe
 *   → onResult(transcript) → restart recorder for next chunk
 *   click stop → teardown
 *
 * Works in all browsers including Brave (no Web Speech API required).
 */

const SILENCE_THRESHOLD = 0.01   // RMS below this = silence
const SILENCE_MS        = 700    // ms of silence before flushing a chunk (lower = faster response)
const MIN_CHUNK_MS      = 300    // don't flush chunks shorter than this
const VAD_INTERVAL_MS   = 50     // how often to sample RMS

export function useSpeechDictation(onResult: (transcript: string) => void, options?: SpeechDictationOptions) {
  void options  // reserved for future use (e.g. language override)
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  const wantListeningRef   = useRef(false)
  const onResultRef        = useRef(onResult)
  const streamRef          = useRef<MediaStream | null>(null)
  const recorderRef        = useRef<MediaRecorder | null>(null)
  const audioCtxRef        = useRef<AudioContext | null>(null)
  const vadTimerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const silenceStartRef    = useRef<number | null>(null)
  const chunkStartRef      = useRef<number>(0)
  const chunksRef          = useRef<Blob[]>([])
  const analyserRef        = useRef<AnalyserNode | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vadDataRef         = useRef<any>(null)

  useEffect(() => { onResultRef.current = onResult }, [onResult])

  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  // -------------------------------------------------------------------------
  // Core: flush current chunk to Whisper
  // -------------------------------------------------------------------------
  const flushChunk = useCallback(async (mimeType: string) => {
    const chunks = chunksRef.current.splice(0)
    if (chunks.length === 0) return

    const blob = new Blob(chunks, { type: mimeType })
    if (blob.size < 1000) return   // too small to contain speech

    setIsTranscribing(true)
    try {
      const form = new FormData()
      form.append('audio', blob, 'audio.' + extensionForMime(mimeType))
      form.append('mimeType', mimeType)
      form.append('language', navigator.language?.split('-')[0] ?? 'en')

      const res = await fetch(`${import.meta.env.VITE_API_URL}/speech/transcribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      })

      if (res.ok) {
        const data = await res.json() as { transcript?: string }
        const text = data.transcript?.trim() ?? ''
        if (text) onResultRef.current(text)
      }
    } catch {
      /* network error — silently skip chunk */
    } finally {
      setIsTranscribing(false)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Start a fresh MediaRecorder segment
  // -------------------------------------------------------------------------
  const startSegment = useCallback((stream: MediaStream) => {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/webm'

    const recorder = new MediaRecorder(stream, { mimeType })
    chunksRef.current = []
    chunkStartRef.current = Date.now()
    silenceStartRef.current = null

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      if (wantListeningRef.current) {
        flushChunk(mimeType).then(() => {
          if (wantListeningRef.current && streamRef.current) {
            startSegment(streamRef.current)
          }
        })
      } else {
        flushChunk(mimeType)
      }
    }

    recorder.start(200)   // collect data every 200ms
    recorderRef.current = recorder
  }, [flushChunk])

  // -------------------------------------------------------------------------
  // VAD loop — polls AnalyserNode RMS; stops recorder on sustained silence
  // -------------------------------------------------------------------------
  const startVad = useCallback((stream: MediaStream) => {
    const audioCtx = new AudioContext()
    audioCtxRef.current = audioCtx
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    analyserRef.current = analyser
    vadDataRef.current = new Float32Array(analyser.fftSize)

    vadTimerRef.current = setInterval(() => {
      if (!analyserRef.current || !vadDataRef.current) return
      analyserRef.current.getFloatTimeDomainData(vadDataRef.current)
      let sum = 0
      for (const s of vadDataRef.current) sum += s * s
      const rms = Math.sqrt(sum / vadDataRef.current.length)

      const now = Date.now()
      const chunkAge = now - chunkStartRef.current

      if (rms < SILENCE_THRESHOLD) {
        if (silenceStartRef.current === null) silenceStartRef.current = now
        const silenceDuration = now - silenceStartRef.current
        if (silenceDuration >= SILENCE_MS && chunkAge >= MIN_CHUNK_MS) {
          // Flush: stop recorder (onstop will restart it)
          silenceStartRef.current = null
          const rec = recorderRef.current
          if (rec && rec.state === 'recording') rec.stop()
        }
      } else {
        silenceStartRef.current = null
      }
    }, VAD_INTERVAL_MS)
  }, [])

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  const startListening = useCallback(async () => {
    if (wantListeningRef.current) return
    wantListeningRef.current = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      if (!wantListeningRef.current) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      setIsListening(true)
      startVad(stream)
      startSegment(stream)
    } catch {
      wantListeningRef.current = false
      setIsListening(false)
    }
  }, [startVad, startSegment])

  const stopListening = useCallback(() => {
    wantListeningRef.current = false

    if (vadTimerRef.current !== null) {
      clearInterval(vadTimerRef.current)
      vadTimerRef.current = null
    }

    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    vadDataRef.current = null

    const rec = recorderRef.current
    recorderRef.current = null
    if (rec && rec.state !== 'inactive') rec.stop()
    else {
      // recorder already stopped — flush manually
      const mimeType = rec?.mimeType ?? 'audio/webm'
      flushChunk(mimeType)
    }

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setIsListening(false)
  }, [flushChunk])

  const toggleListening = useCallback(() => {
    if (wantListeningRef.current) stopListening()
    else void startListening()
  }, [startListening, stopListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wantListeningRef.current = false
      if (vadTimerRef.current !== null) clearInterval(vadTimerRef.current)
      audioCtxRef.current?.close()
      if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return { isListening, isTranscribing, isSupported, startListening, stopListening, toggleListening }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function extensionForMime(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase()
  if (base === 'audio/ogg') return 'ogg'
  if (base === 'audio/wav' || base === 'audio/wave') return 'wav'
  if (base === 'audio/mp4' || base === 'video/mp4') return 'mp4'
  return 'webm'
}
