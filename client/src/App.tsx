import { useEffect, useRef, useState } from 'react'

import { AudioVisualizer } from './components/AudioVisualizer'
import { LanguageSelector } from './components/LanguageSelector'

const IS_WEBGPU_AVAILABLE = 'gpu' in navigator
const WHISPER_SAMPLING_RATE = 16_000

function App() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // server-only mode: always ready
  const status = 'ready'

  const [text, setText] = useState('')
  const [language, setLanguage] = useState('en')

  const [recording, setRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [chunks, setChunks] = useState<Blob[]>([])
  // always use server-side transcription
  const [useServer, setUseServer] = useState(true)
  const [stream, setStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    if (recorderRef.current) return

    if (navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((s) => {
          setStream(s)

          recorderRef.current = new MediaRecorder(s)
          audioContextRef.current = new AudioContext({
            sampleRate: WHISPER_SAMPLING_RATE,
          })

          recorderRef.current.onstart = () => {
            setRecording(true)
            setChunks([])
          }
          recorderRef.current.ondataavailable = (e: BlobEvent) => {
            if (e.data.size > 0) {
              setChunks((prev) => [...prev, e.data])
            } else {
              setTimeout(() => {
                recorderRef.current?.requestData()
              }, 25)
            }
          }

          recorderRef.current.onstop = () => {
            setRecording(false)
          }
          // start recording immediately in server-only mode
          try {
            recorderRef.current.start()
          } catch (err) {
            // ignore start errors (e.g. already started)
            // log at debug level for diagnostics
            console.debug('recorder start failed', err)
          }
        })
        .catch((err) => console.error('The following error occurred: ', err))
    } else {
      console.error('getUserMedia not supported on your browser!')
    }

    return () => {
      recorderRef.current?.stop()
      recorderRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!recorderRef.current) return
    if (!recording) return
    if (isProcessing) return
    if (status !== 'ready') return

    if (chunks.length > 0) {
      const blob = new Blob(chunks, { type: recorderRef.current.mimeType })

      // Always send to server-side transcription
      ;(async () => {
        setIsProcessing(true)
        try {
          const fd = new FormData()
          fd.append('file', blob, 'recording.wav')
          fd.append('language', language)
          const res = await fetch('http://localhost:8000/transcribe', {
            method: 'POST',
            body: fd,
          })
          if (!res.ok) {
            throw new Error(await res.text())
          }
          const j = await res.json()
          setText(j.text || j?.result || '')
        } catch (err: unknown) {
          console.error(err)
          const message = err instanceof Error ? err.message : String(err)
          setText('Error: ' + message)
        } finally {
          setIsProcessing(false)
          recorderRef.current?.requestData()
        }
      })()
    } else {
      recorderRef.current?.requestData()
    }
  }, [status, recording, isProcessing, chunks, language, useServer])

  return IS_WEBGPU_AVAILABLE ? (
    <div className="flex flex-col justify-end h-screen mx-auto text-gray-800 bg-white dark:text-gray-200 dark:bg-gray-900">
      {
        <div className="relative flex flex-col items-center justify-center h-full overflow-auto scrollbar-thin">
          <div className="flex flex-col items-center mb-1 text-center max-w-100">
            <img
              src="logo.png"
              width="50%"
              height="auto"
              className="block"
            ></img>
            <h1 className="mb-1 text-4xl font-bold">Whisper WebGPU</h1>
            <h2 className="text-xl font-semibold">
              Real-time in-browser speech recognition
            </h2>
          </div>

          <div className="flex flex-col items-center px-4">
            <p className="mb-4 text-center max-w-120">
              This app uses the local `/transcribe` API for transcription.
            </p>

            <div className="p-2 w-125">
              <AudioVisualizer
                className="w-full mb-3 rounded-lg"
                stream={stream}
              />
              {status === 'ready' && (
                <div className="relative">
                  <p className="w-full h-20 p-2 overflow-y-auto border rounded-lg overflow-wrap-anywhere">
                    {text}
                  </p>
                </div>
              )}
            </div>
            {status === 'ready' && (
              <div className="relative flex items-center justify-around w-full gap-4 py-2">
                <LanguageSelector
                  language={language}
                  setLanguage={(e: string) => {
                    recorderRef.current?.stop()
                    setLanguage(e)
                    recorderRef.current?.start()
                  }}
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useServer}
                    onChange={(ev) => setUseServer(ev.target.checked)}
                  />
                  <span className="text-sm">Use Local Server</span>
                </label>
                <button
                  className="px-3 py-1 border rounded-lg cursor-pointer"
                  onClick={() => {
                    recorderRef.current?.stop()
                    recorderRef.current?.start()
                  }}
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>
      }
    </div>
  ) : (
    <div className="fixed w-screen h-screen bg-black z-10 bg-opacity-[92%] text-white text-2xl font-semibold flex justify-center items-center text-center">
      WebGPU is not supported
      <br />
      by this browser :(
    </div>
  )
}

export default App
