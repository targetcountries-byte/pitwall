import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DriverData } from './api'

interface Store {
  year: number; event: string; session: string
  drivers: string[]; driverData: Record<string, DriverData>
  theme: string; mode: 'essential' | 'expert'; lang: string
  fuelCorr: boolean; hideOutliers: boolean; smoothChart: boolean
  showTrackStatus: boolean; autoSelectFastest: boolean
  annotateCharts: boolean
  favoriteDrivers: string[]
  setYear: (y: number) => void; setEvent: (e: string) => void; setSession: (s: string) => void
  toggleDriver: (d: string) => void; setDrivers: (ds: string[]) => void
  setDriverData: (code: string, data: DriverData) => void; clearDriverData: () => void
  setTheme: (t: string) => void; setMode: (m: 'essential' | 'expert') => void
  setLang: (l: string) => void
  toggle: (f: keyof Pick<Store, 'fuelCorr'|'hideOutliers'|'smoothChart'|'showTrackStatus'|'autoSelectFastest'|'annotateCharts'>) => void
  addFavorite: (d: string) => void; removeFavorite: (d: string) => void
}

export const useStore = create<Store>()(persist(
  (set) => ({
    year: 2026, event: 'Chinese Grand Prix', session: 'Q',
    drivers: [], driverData: {},
    theme: 'tracinginsights', mode: 'essential', lang: 'EN',
    fuelCorr: false, hideOutliers: true, smoothChart: true,
    showTrackStatus: true, autoSelectFastest: true, annotateCharts: false,
    favoriteDrivers: [],

    setYear:    y => set({ year: y, drivers: [], driverData: {} }),
    setEvent:   e => set({ event: e, drivers: [], driverData: {} }),
    setSession: s => set({ session: s, drivers: [], driverData: {} }),

    toggleDriver: d => set(s => ({
      drivers: s.drivers.includes(d) ? s.drivers.filter(x => x !== d) : [...s.drivers, d],
    })),
    setDrivers: drivers => set({ drivers }),

    setDriverData: (code, data) => set(s => {
      const ex = s.driverData[code]
      if (ex && ex.laps.length === data.laps.length && ex.tel.length === data.tel.length && ex.selectedLap === data.selectedLap && ex.tel.length > 0) return s
      return { driverData: { ...s.driverData, [code]: data } }
    }),
    clearDriverData: () => set({ driverData: {} }),

    setTheme: t => {
      set({ theme: t })
      if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', t)
    },
    setMode: m => set({ mode: m }),
    setLang: l => set({ lang: l }),
    toggle: f => set(s => ({ [f]: !s[f as keyof Store] } as any)),
    addFavorite: d => set(s => ({ favoriteDrivers: [...new Set([...s.favoriteDrivers, d.toUpperCase().slice(0,3)])] })),
    removeFavorite: d => set(s => ({ favoriteDrivers: s.favoriteDrivers.filter(f => f !== d) })),
  }),
  {
    name: 'ti-pitwall-v1',
    partialize: s => ({
      theme: s.theme, mode: s.mode, lang: s.lang,
      favoriteDrivers: s.favoriteDrivers,
      fuelCorr: s.fuelCorr, hideOutliers: s.hideOutliers,
      smoothChart: s.smoothChart, showTrackStatus: s.showTrackStatus,
      autoSelectFastest: s.autoSelectFastest, annotateCharts: s.annotateCharts,
    }),
  }
))
