export interface ScreenRecorder {
  stop: () => void
}

export interface RecorderOptions {
  onStop: (recording: Blob) => void
  userStream?: MediaStream | null
  getWebcamPosition?: () => { x: number; y: number }
}

const MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

function pickMimeType(): string {
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function createVideo(stream: MediaStream): HTMLVideoElement {
  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  void video.play()
  return video
}

function composeStreams(
  screenStream: MediaStream,
  webcamStream: MediaStream,
  getWebcamPosition?: () => { x: number; y: number },
): { stream: MediaStream; cleanup: () => void } {
  const screenVideo = createVideo(screenStream)
  const webcamVideo = createVideo(webcamStream)

  const canvas = document.createElement('canvas')
  const settings = screenStream.getVideoTracks()[0]?.getSettings()
  canvas.width = settings?.width ?? 1920
  canvas.height = settings?.height ?? 1080
  const ctx = canvas.getContext('2d')!

  const draw = () => {
    ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height)
    const camWidth = Math.round(canvas.width * 0.2)
    const aspect = webcamVideo.videoWidth / webcamVideo.videoHeight || 4 / 3
    const camHeight = Math.round(camWidth / aspect)
    const position = getWebcamPosition?.() ?? { x: 1, y: 1 }
    const x = position.x * (canvas.width - camWidth)
    const y = position.y * (canvas.height - camHeight)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, camWidth, camHeight, camWidth * 0.06)
    ctx.clip()
    ctx.drawImage(webcamVideo, x, y, camWidth, camHeight)
    ctx.restore()
  }

  // setInterval instead of requestAnimationFrame so drawing continues in background tabs
  const interval = window.setInterval(draw, 1000 / 30)
  return { stream: canvas.captureStream(30), cleanup: () => window.clearInterval(interval) }
}

export async function startRecording({
  onStop,
  userStream,
  getWebcamPosition,
}: RecorderOptions): Promise<ScreenRecorder> {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 30 } },
    audio: true,
  })

  const webcamTrack = userStream?.getVideoTracks()[0] ?? null
  const micTracks = userStream?.getAudioTracks() ?? []
  const screenAudioTracks = screenStream.getAudioTracks()

  let videoTracks: MediaStreamTrack[]
  let cleanupCompositor: (() => void) | null = null

  if (webcamTrack) {
    const composed = composeStreams(screenStream, new MediaStream([webcamTrack]), getWebcamPosition)
    videoTracks = composed.stream.getVideoTracks()
    cleanupCompositor = composed.cleanup
  } else {
    videoTracks = screenStream.getVideoTracks()
  }

  let audioTracks: MediaStreamTrack[]
  let audioContext: AudioContext | null = null

  if (screenAudioTracks.length && micTracks.length) {
    audioContext = new AudioContext()
    const destination = audioContext.createMediaStreamDestination()
    audioContext.createMediaStreamSource(new MediaStream(screenAudioTracks)).connect(destination)
    audioContext.createMediaStreamSource(new MediaStream(micTracks)).connect(destination)
    audioTracks = destination.stream.getAudioTracks()
  } else {
    audioTracks = [...screenAudioTracks, ...micTracks]
  }

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(
    new MediaStream([...videoTracks, ...audioTracks]),
    mimeType ? { mimeType } : undefined,
  )
  const chunks: Blob[] = []

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })

  recorder.addEventListener('stop', () => {
    cleanupCompositor?.()
    void audioContext?.close()
    screenStream.getTracks().forEach((track) => track.stop())
    userStream?.getTracks().forEach((track) => track.stop())
    onStop(new Blob(chunks, { type: mimeType || 'video/webm' }))
  })

  // Stop recording when the user ends sharing from the browser UI
  screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (recorder.state !== 'inactive') recorder.stop()
  })

  recorder.start()

  return {
    stop: () => {
      if (recorder.state !== 'inactive') recorder.stop()
    },
  }
}
