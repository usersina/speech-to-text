import { useCallback, useEffect, useRef, useState } from 'react'
import Select from 'react-select'

const API_BASE = 'http://localhost:8000'

interface LanguageOption {
  value: string | null
  label: string
}

interface TranscriptChunk {
  id: number
  text: string
  language: string | null
  timestamp: Date
}

const AUTO_OPTION: LanguageOption = { value: null, label: 'Auto-detect' }
const MAX_RECORDING_MS = 20 * 60 * 1000 // 20 minutes

export default function App() {
  const [languages, setLanguages] = useState<LanguageOption[]>([AUTO_OPTION])
  const [selectedLanguage, setSelectedLanguage] =
    useState<LanguageOption>(AUTO_OPTION)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptChunk[]>([])
  const [error, setError] = useState<string | null>(null)
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)
  const [elapsed, setElapsed] = useState(0) // seconds

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const chunkCounterRef = useRef(0)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`)
        setServerOnline(res.ok)
      } catch {
        setServerOnline(false)
      }
    }
    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/languages`)
        const data = await res.json()
        const opts: LanguageOption[] = (data.languages as string[]).map(
          (l) => ({
            value: l,
            label: l,
          }),
        )
        setLanguages([AUTO_OPTION, ...opts])
      } catch {
        /* keep AUTO_OPTION only */
      }
    }
    load()
  }, [])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  const sendChunk = useCallback(
    async (blob: Blob) => {
      if (blob.size < 1000) return
      setIsTranscribing(true)
      try {
        const form = new FormData()
        form.append('file', blob, 'chunk.webm')
        if (selectedLanguage.value)
          form.append('language', selectedLanguage.value)

        const res = await fetch(`${API_BASE}/transcribe`, {
          method: 'POST',
          body: form,
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.detail ?? 'Transcription failed')
        }
        const data = await res.json()
        if (data.text?.trim()) {
          setTranscript((prev) => [
            ...prev,
            {
              id: chunkCounterRef.current++,
              text: data.text.trim(),
              language: data.language ?? null,
              timestamp: new Date(),
            },
          ])
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setIsTranscribing(false)
      }
    },
    [selectedLanguage],
  )

  const stopRecording = useCallback(() => {
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current)
      chunkIntervalRef.current = null
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current)
      maxTimeoutRef.current = null
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current)
      elapsedIntervalRef.current = null
    }
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setIsRecording(false)
    setElapsed(0)
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.start(500)

      // Buffer chunks locally and send a single blob when recording stops
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []
        if (blob.size > 1000) {
          await sendChunk(blob)
        }
      }

      // Auto-stop after MAX_RECORDING_MS
      maxTimeoutRef.current = setTimeout(() => {
        stopRecording()
        setError('Recording stopped automatically after 20 minutes.')
      }, MAX_RECORDING_MS)

      // Elapsed timer (tick every second)
      setElapsed(0)
      elapsedIntervalRef.current = setInterval(() => {
        setElapsed((s) => s + 1)
      }, 1000)

      setIsRecording(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone access denied')
    }
  }, [sendChunk, stopRecording])

  const fullText = transcript.map((c) => c.text).join(' ')

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  return (
    <div className="app">
      <div className="noise" />

      <header className="header">
        <div className="status-pill">
          <span
            className={`dot ${serverOnline === true ? 'on' : serverOnline === false ? 'off' : 'wait'}`}
          />
          {serverOnline === true
            ? 'Live'
            : serverOnline === false
              ? 'Offline'
              : '…'}
        </div>
        <div className="wordmark">
          <span className="wm-s">s</span>peak
        </div>
        <div className="model-badge">Qwen3-ASR · 1.7B</div>
      </header>

      <main className="main">
        <div className="lang-field">
          <label className="field-label">Language</label>
          <Select<LanguageOption>
            options={languages}
            value={selectedLanguage}
            onChange={(opt) => opt && setSelectedLanguage(opt)}
            isDisabled={isRecording}
            classNamePrefix="ls"
            isSearchable
            menuPlacement="auto"
          />
        </div>

        <div className="center-controls">
          <button
            className={`rec-btn ${isRecording ? 'active' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={serverOnline === false}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <span className="rec-icon">
              {isRecording ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  width="22"
                  height="22"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2.5" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  width="22"
                  height="22"
                >
                  <circle cx="12" cy="12" r="5.5" />
                </svg>
              )}
            </span>
            <span>{isRecording ? 'Stop' : 'Start'}</span>
          </button>

          {isRecording && (
            <div className="live-bar">
              <span className="live-rings">
                <span />
                <span />
                <span />
              </span>
              <span className="live-label">
                {isTranscribing ? 'Transcribing…' : 'Listening…'}
              </span>
              <span className="elapsed">{formatElapsed(elapsed)}</span>
              <span className="elapsed-max">/ 20:00</span>
            </div>
          )}
        </div>

        {error && (
          <div className="error-toast">
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        <section className="transcript-section">
          <div className="ts-header">
            <span className="ts-title">Transcript</span>
            <div className="ts-actions">
              <button
                className="ts-btn"
                onClick={() => navigator.clipboard.writeText(fullText)}
                disabled={!transcript.length}
              >
                Copy
              </button>
              <button
                className="ts-btn"
                onClick={() => setTranscript([])}
                disabled={!transcript.length}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="ts-box">
            {transcript.length === 0 ? (
              <p className="ts-empty">
                {isRecording ? 'Speak now…' : 'Press Record to begin.'}
              </p>
            ) : (
              <>
                <p className="ts-full">{fullText}</p>
                <div className="ts-timeline">
                  {transcript.map((chunk) => (
                    <div key={chunk.id} className="ts-chunk">
                      <span className="ts-time">
                        {chunk.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                      {chunk.language && (
                        <span className="ts-lang">{chunk.language}</span>
                      )}
                      <span className="ts-chunk-text">{chunk.text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </section>
      </main>
    </div>
  )
}
