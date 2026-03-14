import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MonitoringSettings } from '@/types'

interface SettingsStore {
  settings: MonitoringSettings
  updateSettings: (settings: Partial<MonitoringSettings>) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: {
        pingInterval: 10,
        enabled: true,
      },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
    }),
    {
      name: 'computerzentrale-settings',
    }
  )
)
