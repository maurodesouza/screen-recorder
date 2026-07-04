import './style.css'
import { startRecording, type ScreenRecorder } from './recorder.ts'
import { saveRecording } from './save-file.ts'
import { setupTheme } from './theme.ts'
import { createWebcamOverlay } from './webcam-overlay.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div class="flex min-h-screen flex-col bg-white text-neutral-900 transition-colors dark:bg-neutral-950 dark:text-neutral-100">
  <header class="flex items-center justify-between px-6 py-4">
    <span class="text-sm font-semibold tracking-wide uppercase text-neutral-500 dark:text-neutral-400">Screen Recorder</span>
    <button id="theme-toggle" type="button" aria-label="Toggle theme"
      class="rounded-full p-2 text-xl transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
      <span class="dark:hidden">🌙</span>
      <span class="hidden dark:inline">☀️</span>
    </button>
  </header>

  <main class="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
    <div class="flex flex-col gap-3">
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">Record your screen</h1>
      <p class="mx-auto max-w-md text-neutral-500 dark:text-neutral-400">
        Free, in your browser. No installs, no sign-up, no watermarks.
        When you finish, choose where to save the video on your computer.
      </p>
    </div>

    <div class="flex flex-col items-center gap-4">
      <div class="flex items-center gap-6 text-sm">
        <label class="flex cursor-pointer items-center gap-2">
          <input id="mic-toggle" type="checkbox" class="size-4 accent-red-600" />
          Microphone
        </label>
        <label class="flex cursor-pointer items-center gap-2">
          <input id="cam-toggle" type="checkbox" class="size-4 accent-red-600" />
          Webcam
        </label>
      </div>

      <p id="timer" class="hidden font-mono text-3xl tabular-nums" aria-live="polite">00:00</p>

      <button id="record" type="button"
        class="inline-flex items-center gap-3 rounded-full bg-red-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-red-500 active:scale-95">
        <span class="size-3 rounded-full bg-white"></span>
        Start recording
      </button>

      <button id="stop" type="button"
        class="hidden items-center gap-3 rounded-full bg-neutral-900 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-neutral-700 active:scale-95 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
        <span class="size-3 rounded-sm bg-red-500"></span>
        Stop and save
      </button>

      <p id="status" class="min-h-6 text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite"></p>
    </div>
  </main>

  <footer class="px-6 py-4 text-center text-xs text-neutral-400 dark:text-neutral-600">
    Your recording never leaves your device — everything runs locally in your browser.
  </footer>
</div>
`

setupTheme(document.querySelector<HTMLButtonElement>('#theme-toggle')!)

const recordButton = document.querySelector<HTMLButtonElement>('#record')!
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!
const timer = document.querySelector<HTMLParagraphElement>('#timer')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const micToggle = document.querySelector<HTMLInputElement>('#mic-toggle')!
const camToggle = document.querySelector<HTMLInputElement>('#cam-toggle')!
const webcamOverlay = createWebcamOverlay()

let recorder: ScreenRecorder | null = null
let timerInterval: number | undefined

function setRecordingUI(recording: boolean) {
  recordButton.classList.toggle('hidden', recording)
  stopButton.classList.toggle('hidden', !recording)
  stopButton.classList.toggle('inline-flex', recording)
  timer.classList.toggle('hidden', !recording)
  micToggle.disabled = recording
  camToggle.disabled = recording
}

function startTimer() {
  const startedAt = Date.now()
  timer.textContent = '00:00'
  timerInterval = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000)
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const seconds = String(elapsed % 60).padStart(2, '0')
    timer.textContent = `${minutes}:${seconds}`
  }, 1000)
}

function stopTimer() {
  window.clearInterval(timerInterval)
}

async function handleRecordingStopped(recording: Blob) {
  recorder = null
  stopTimer()
  setRecordingUI(false)
  webcamOverlay.hide()

  try {
    const saved = await saveRecording(recording)
    status.textContent = saved ? 'Recording saved!' : 'Save canceled — the recording was discarded.'
  } catch {
    status.textContent = 'Could not save the recording. Please try again.'
  }
}

recordButton.addEventListener('click', async () => {
  status.textContent = ''

  let userStream: MediaStream | null = null
  if (micToggle.checked || camToggle.checked) {
    try {
      userStream = await navigator.mediaDevices.getUserMedia({
        audio: micToggle.checked,
        video: camToggle.checked ? { width: { ideal: 1280 } } : false,
      })
    } catch {
      status.textContent = 'Microphone/webcam access was denied.'
      return
    }
  }

  try {
    recorder = await startRecording({
      onStop: handleRecordingStopped,
      userStream,
      getWebcamPosition: webcamOverlay.getPosition,
    })
  } catch {
    userStream?.getTracks().forEach((track) => track.stop())
    status.textContent = 'Screen capture was blocked or canceled.'
    return
  }

  const webcamTrack = userStream?.getVideoTracks()[0]
  if (webcamTrack) {
    webcamOverlay.show(new MediaStream([webcamTrack]))
    status.textContent = 'Drag the camera preview to position it in the recording.'
  }

  setRecordingUI(true)
  startTimer()
})

stopButton.addEventListener('click', () => recorder?.stop())
