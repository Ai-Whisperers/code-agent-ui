import { useCallback, useEffect, useRef, useState } from 'react'
import { getToken } from '@/lib/keycloak'

export type SpeechDictationOptions = {
  /** Called after each silence-delimited chunk is transcribed. */
  onChunkTranscribed?: (transcript: string) => void
}

/**
 * AudioWorklet PCM dictation with energy-threshold VAD.
 *
 * Flow:
 *   click start → getUserMedia → AudioContext (16 kHz) → AudioWorkletNode (PCM collector)
 *                              → AnalyserNode (VAD, read-only)
 *   on silence (RMS < threshold for SILENCE_MS after MIN_CHUNK_MS of speech)
 *     → flush PCM buffer → encode as 16-bit LE WAV → POST to /api/speech/transcribe
 *     → onResult(transcript) → clear buffer, keep listening
 *   click stop → teardown
 *
 * Why PCM instead of MediaRecorder WebM/Opus:
 *   Amazon Transcribe Streaming accepts OGG_OPUS only in a true Ogg container.
 *   Chrome's MediaRecorder produces WebM/Opus (different container), which
 *   Transcribe cannot parse and silently times out on. Raw PCM (signed 16-bit
 *   little-endian, 16 kHz mono) is universally accepted and requires no
 *   container negotiation.
 *
 * Works in all browsers including Brave (no Web Speech API required).
 */

const SAMPLE_RATE       = 16000  // Hz — must match transcribe.sample-rate on the backend
const SILENCE_THRESHOLD = 0.005  // RMS below this = silence (lowered from 0.01 — Brave mic levels tend to be quieter)
const SILENCE_MS        = 1200   // ms of silence before flushing (increased: give Transcribe more audio context)
const MIN_CHUNK_MS      = 500    // don't flush chunks shorter than this
const VAD_INTERVAL_MS   = 50     // how often to sample RMS

// Inline AudioWorklet processor as a Blob URL so no extra static asset is needed.
// The processor collects Float32 samples from the microphone and posts them back
// to the main thread in batches.
const WORKLET_CODE = `
class PcmCollectorProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0]
    if (ch && ch.length > 0) {
      // Transfer a copy so the main thread can own the buffer
      const copy = new Float32Array(ch)
      this.port.postMessage(copy, [copy.buffer])
    }
    return true
  }
}
registerProcessor('pcm-collector', PcmCollectorProcessor)
`

export function useSpeechDictation(onResult: (transcript: string) => void, options?: SpeechDictationOptions) {
  void options
  const [isListening, setIsListening]       = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  const wantListeningRef = useRef(false)
  const onResultRef      = useRef(onResult)
  const streamRef        = useRef<MediaStream | null>(null)
  const audioCtxRef      = useRef<AudioContext | null>(null)
  const workletRef       = useRef<AudioWorkletNode | null>(null)
  const analyserRef      = useRef<AnalyserNode | null>(null)
  const vadTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const vadDataRef       = useRef<Float32Array<ArrayBuffer> | null>(null)

  // PCM sample accumulator (Float32, mono, SAMPLE_RATE Hz)
  const samplesRef       = useRef<Float32Array<ArrayBuffer>[]>([])
  const chunkStartRef    = useRef<number>(0)
  const silenceStartRef  = useRef<number | null>(null)
  const isFlushing       = useRef(false)

  useEffect(() => { onResultRef.current = onResult }, [onResult])

  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  // -------------------------------------------------------------------------
  // Flush accumulated PCM samples → WAV → POST to backend
  // -------------------------------------------------------------------------
  const flushChunk = useCallback(async () => {
    if (isFlushing.current) return
    const batches = samplesRef.current.splice(0)
    if (batches.length === 0) return

    // Count total samples
    const totalSamples = batches.reduce((n, b) => n + b.length, 0)
    // Minimum ~200 ms of audio at 16 kHz = 3200 samples
    if (totalSamples < 3200) return

    isFlushing.current = true
    setIsTranscribing(true)
    try {
      const wav = encodePcmToWav(batches, totalSamples, SAMPLE_RATE)
      const blob = new Blob([wav], { type: 'audio/wav' })

      const form = new FormData()
      form.append('audio', blob, 'audio.wav')
      form.append('mimeType', 'audio/wav')
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
      isFlushing.current = false
      setIsTranscribing(false)
    }
  }, [])

  // -------------------------------------------------------------------------
  // VAD loop — polls AnalyserNode RMS; flushes on sustained silence
  // -------------------------------------------------------------------------
  const startVad = useCallback(() => {
    vadTimerRef.current = setInterval(() => {
      if (!analyserRef.current || !vadDataRef.current) return
      analyserRef.current.getFloatTimeDomainData(vadDataRef.current)
      let sum = 0
      for (const s of vadDataRef.current) sum += s * s
      const rms = Math.sqrt(sum / vadDataRef.current.length)

      const now      = Date.now()
      const chunkAge = now - chunkStartRef.current

      if (rms < SILENCE_THRESHOLD) {
        if (silenceStartRef.current === null) silenceStartRef.current = now
        const silenceDuration = now - silenceStartRef.current
        if (silenceDuration >= SILENCE_MS && chunkAge >= MIN_CHUNK_MS) {
          silenceStartRef.current = null
          chunkStartRef.current   = now
          void flushChunk()
        }
      } else {
        silenceStartRef.current = null
      }
    }, VAD_INTERVAL_MS)
  }, [flushChunk])

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  const startListening = useCallback(async () => {
    if (wantListeningRef.current) return
    wantListeningRef.current = true

    try {
      // Request mono with echo cancellation. Do NOT constrain sampleRate here —
      // Brave and some OS audio drivers reject getUserMedia if the device doesn't
      // natively report 16 kHz. The AudioContext below handles resampling to 16 kHz.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true },
        video: false,
      })
      if (!wantListeningRef.current) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream

      // AudioContext at 16 kHz so no resampling is needed
      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
      audioCtxRef.current = audioCtx

      // Register and connect the worklet
      const blobUrl = URL.createObjectURL(new Blob([WORKLET_CODE], { type: 'application/javascript' }))
      await audioCtx.audioWorklet.addModule(blobUrl)
      URL.revokeObjectURL(blobUrl)

      const source  = audioCtx.createMediaStreamSource(stream)
      const worklet = new AudioWorkletNode(audioCtx, 'pcm-collector')
      workletRef.current = worklet

      worklet.port.onmessage = (e: MessageEvent<Float32Array<ArrayBuffer>>) => {
        if (wantListeningRef.current) samplesRef.current.push(e.data)
      }

      // Analyser for VAD (read-only, no effect on audio)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      analyserRef.current = analyser
      vadDataRef.current  = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>

      source.connect(analyser)
      source.connect(worklet)
      // worklet output is not connected to destination — we only want the side-effect of onmessage

      chunkStartRef.current   = Date.now()
      silenceStartRef.current = null
      samplesRef.current      = []

      setIsListening(true)
      startVad()
    } catch {
      wantListeningRef.current = false
      setIsListening(false)
    }
  }, [startVad])

  const stopListening = useCallback(() => {
    wantListeningRef.current = false

    if (vadTimerRef.current !== null) {
      clearInterval(vadTimerRef.current)
      vadTimerRef.current = null
    }

    workletRef.current?.disconnect()
    workletRef.current = null

    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    vadDataRef.current  = null

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null

    setIsListening(false)

    // Flush any remaining samples
    void flushChunk()
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
      workletRef.current?.disconnect()
      audioCtxRef.current?.close()
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return { isListening, isTranscribing, isSupported, startListening, stopListening, toggleListening }
}

// ---------------------------------------------------------------------------
// WAV encoder — wraps Float32 PCM samples in a minimal RIFF/WAV header.
// Output: signed 16-bit little-endian, mono, at the given sample rate.
// ---------------------------------------------------------------------------
function encodePcmToWav(batches: Float32Array<ArrayBuffer>[], totalSamples: number, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2
  const dataBytes      = totalSamples * bytesPerSample
  const buffer         = new ArrayBuffer(44 + dataBytes)
  const view           = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4,  36 + dataBytes, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)          // chunk size
  view.setUint16(20, 1,  true)          // PCM
  view.setUint16(22, 1,  true)          // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)  // byte rate
  view.setUint16(32, bytesPerSample, true)               // block align
  view.setUint16(34, 16, true)          // bits per sample

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  // Interleave samples
  let offset = 44
  for (const batch of batches) {
    for (let i = 0; i < batch.length; i++) {
      // Clamp and convert Float32 [-1, 1] → Int16
      const s = Math.max(-1, Math.min(1, batch[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }

  return buffer
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
