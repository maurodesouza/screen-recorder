type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

function getPreferredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function setupTheme(toggleButton: HTMLButtonElement) {
  applyTheme(getPreferredTheme())

  toggleButton.addEventListener('click', () => {
    const next: Theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
  })

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    if (!localStorage.getItem(STORAGE_KEY)) applyTheme(event.matches ? 'dark' : 'light')
  })
}
