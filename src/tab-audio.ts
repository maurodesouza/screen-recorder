export class TabAudioError extends Error {}

export async function captureTabAudio(): Promise<MediaStream> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' },
      audio: true,
      monitorTypeSurfaces: 'exclude',
      systemAudio: 'include',
    } as DisplayMediaStreamOptions)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotReadableError') {
      throw new TabAudioError('Audio can only be captured from a browser tab — please pick a tab.')
    }
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      throw new TabAudioError('Tab audio selection was canceled.')
    }
    throw error
  }

  // Only the audio matters — drop the tab's video track right away
  stream.getVideoTracks().forEach((track) => track.stop())

  const audioTracks = stream.getAudioTracks()
  if (!audioTracks.length) {
    stream.getTracks().forEach((track) => track.stop())
    throw new TabAudioError('No tab audio was shared — keep "Also share tab audio" enabled and try again.')
  }

  return new MediaStream(audioTracks)
}
