declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      types?: { description: string; accept: Record<string, string[]> }[]
    }) => Promise<FileSystemFileHandle>
  }
}

function defaultFileName(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `screen-recording-${timestamp}.webm`
}

export async function saveRecording(recording: Blob): Promise<boolean> {
  const fileName = defaultFileName()

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'WebM video', accept: { 'video/webm': ['.webm'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(recording)
      await writable.close()
      return true
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false
      throw error
    }
  }

  const url = URL.createObjectURL(recording)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
  return true
}
