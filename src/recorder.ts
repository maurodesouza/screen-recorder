export interface ScreenRecorder {
  stop: () => void
}

export interface RecorderCallbacks {
  onStop: (recording: Blob) => void
}

const MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

function pickMimeType(): string {
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export async function startRecording({ onStop }: RecorderCallbacks): Promise<ScreenRecorder> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 30 } },
    audio: true,
  })

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })

  recorder.addEventListener('stop', () => {
    stream.getTracks().forEach((track) => track.stop())
    onStop(new Blob(chunks, { type: mimeType || 'video/webm' }))
  })

  // Stop recording when the user ends sharing from the browser UI
  stream.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (recorder.state !== 'inactive') recorder.stop()
  })

  recorder.start()

  return {
    stop: () => {
      if (recorder.state !== 'inactive') recorder.stop()
    },
  }
}
