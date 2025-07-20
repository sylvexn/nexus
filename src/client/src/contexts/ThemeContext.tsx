import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'dark' | 'light' | 'system'

interface ThemeContextType {
  theme: Theme
  actualTheme: 'dark' | 'light'
  setTheme: (theme: Theme) => void
  gradients: {
    primary: string
    secondary: string
    accent: string
    subtle: string
  }
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'nexusdrop-theme'

const themeGradients = {
  dark: {
    primary: 'from-purple-600 via-purple-700 to-purple-800',
    secondary: 'from-purple-800 via-purple-900 to-slate-900',
    accent: 'from-purple-500/20 via-purple-600/10 to-transparent',
    subtle: 'from-purple-900/30 via-purple-800/20 to-transparent'
  },
  light: {
    primary: 'from-purple-400 via-purple-500 to-purple-600',
    secondary: 'from-purple-100 via-purple-200 to-purple-300',
    accent: 'from-purple-400/20 via-purple-300/10 to-transparent',
    subtle: 'from-purple-100/40 via-purple-50/30 to-transparent'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || 'system'
    }
    return 'system'
  })

  const [actualTheme, setActualTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    const root = window.document.documentElement
    
    const getSystemTheme = (): 'dark' | 'light' => {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    const updateTheme = () => {
      const resolvedTheme = theme === 'system' ? getSystemTheme() : theme
      setActualTheme(resolvedTheme)
      
      root.classList.remove('light', 'dark')
      root.classList.add(resolvedTheme)
    }

    updateTheme()

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', updateTheme)
      return () => mediaQuery.removeEventListener('change', updateTheme)
    }
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    setThemeState(newTheme)
  }

  const value: ThemeContextType = {
    theme,
    actualTheme,
    setTheme,
    gradients: themeGradients[actualTheme]
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
} 