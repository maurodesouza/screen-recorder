export interface WebcamOverlay {
  show: (stream: MediaStream) => void
  hide: () => void
  getPosition: () => { x: number; y: number }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function createWebcamOverlay(): WebcamOverlay {
  const container = document.createElement('div')
  container.className =
    'fixed z-50 hidden w-48 cursor-grab touch-none overflow-hidden rounded-xl shadow-xl ring-2 ring-white/60 select-none active:cursor-grabbing dark:ring-neutral-700'
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.autoplay = true
  video.className = 'pointer-events-none block w-full'
  container.appendChild(video)
  document.body.appendChild(container)

  let position = { x: 1, y: 1 }
  let dragOffset: { dx: number; dy: number } | null = null

  const place = () => {
    const maxX = window.innerWidth - container.offsetWidth
    const maxY = window.innerHeight - container.offsetHeight
    container.style.left = `${position.x * maxX}px`
    container.style.top = `${position.y * maxY}px`
  }

  container.addEventListener('pointerdown', (event) => {
    dragOffset = { dx: event.clientX - container.offsetLeft, dy: event.clientY - container.offsetTop }
    container.setPointerCapture(event.pointerId)
  })

  container.addEventListener('pointermove', (event) => {
    if (!dragOffset) return
    const maxX = window.innerWidth - container.offsetWidth
    const maxY = window.innerHeight - container.offsetHeight
    const left = clamp(event.clientX - dragOffset.dx, 0, maxX)
    const top = clamp(event.clientY - dragOffset.dy, 0, maxY)
    position = { x: maxX ? left / maxX : 0, y: maxY ? top / maxY : 0 }
    place()
  })

  container.addEventListener('pointerup', () => {
    dragOffset = null
  })

  window.addEventListener('resize', place)

  return {
    show(stream) {
      video.srcObject = stream
      container.classList.remove('hidden')
      requestAnimationFrame(place)
    },
    hide() {
      container.classList.add('hidden')
      video.srcObject = null
    },
    getPosition: () => position,
  }
}
