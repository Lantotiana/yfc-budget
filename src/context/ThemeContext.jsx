import { createContext, useContext, useState, useEffect } from 'react'

const DARK = {
  bg: '#08090F', surf: '#111422', surf2: '#181B2E', surf3: '#1E2238',
  bord: 'rgba(255,255,255,0.06)', bord2: 'rgba(255,255,255,0.10)',
  amber: '#F2A84E', amberD: 'rgba(242,168,78,0.13)',
  teal: '#26D9C4',  tealD: 'rgba(38,217,196,0.13)',
  coral: '#F26B6B', coralD: 'rgba(242,107,107,0.13)',
  violet: '#9B8BF4', violetD: 'rgba(155,139,244,0.13)',
  t1: '#EEEEF5', t2: '#7A7D9A', t3: '#44475E',
  shadow: '0 2px 12px rgba(0,0,0,0.5)',
  isDark: true,
}

const LIGHT = {
  bg: '#F4F5FB', surf: '#FFFFFF', surf2: '#EDF0FA', surf3: '#E2E6F4',
  bord: 'rgba(0,0,0,0.06)', bord2: 'rgba(0,0,0,0.10)',
  amber: '#E8933A', amberD: 'rgba(232,147,58,0.12)',
  teal: '#16B5A3',  tealD: 'rgba(22,181,163,0.12)',
  coral: '#E05555', coralD: 'rgba(224,85,85,0.12)',
  violet: '#7060E0', violetD: 'rgba(112,96,224,0.12)',
  t1: '#1A1C2E', t2: '#6B6F8A', t3: '#A0A4BE',
  shadow: '0 2px 12px rgba(26,28,46,0.08)',
  isDark: false,
}

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('theme') === 'dark' } catch { return true }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch {}
  }, [dark])

  const C = dark ? DARK : LIGHT

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d), C }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
