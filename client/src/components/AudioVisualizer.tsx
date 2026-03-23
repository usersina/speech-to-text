import React, { useCallback, useEffect, useRef } from 'react'

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

export function AudioVisualizer({
  stream,
  ...props
}: {
  stream: MediaStream | null
} & React.CanvasHTMLAttributes<HTMLCanvasElement>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const visualize = useCallback((s: MediaStream) => {
    const AudioCtor = (window.AudioContext ??
      window.webkitAudioContext) as unknown as { new (): AudioContext }
    const audioContext = new AudioCtor()
    const source = audioContext.createMediaStreamSource(s)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)

    const canvas = canvasRef.current!
    const canvasCtx = canvas.getContext('2d')!
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const drawVisual = () => {
      requestAnimationFrame(drawVisual)
      analyser.getByteTimeDomainData(dataArray)

      canvasCtx.fillStyle = 'rgb(255, 255, 255)'
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height)

      canvasCtx.lineWidth = 2
      canvasCtx.strokeStyle = 'rgb(0, 0, 0)'
      canvasCtx.beginPath()

      const sliceWidth = (canvas.width * 1.0) / bufferLength

      let x = 0
      for (let i = 0; i < bufferLength; ++i) {
        const v = dataArray[i] / 128.0
        const y = (v * canvas.height) / 2

        if (i === 0) {
          canvasCtx.moveTo(x, y)
        } else {
          canvasCtx.lineTo(x, y)
        }

        x += sliceWidth
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2)
      canvasCtx.stroke()
    }

    drawVisual()
  }, [])

  useEffect(() => {
    if (stream) visualize(stream)
  }, [visualize, stream])

  return <canvas {...props} width={720} height={240} ref={canvasRef}></canvas>
}
