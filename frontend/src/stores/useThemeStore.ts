import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { themes, type ThemeName, type Theme } from '@/lib/themes';
import { type FontName, applyFont } from '@/lib/fonts';

interface ThemeState {
  themeName: ThemeName;
  theme: Theme;
  fontName: FontName;
  hasOpenedAppearance: boolean;
  setTheme: (themeName: ThemeName) => void;
  setFont: (fontName: FontName) => void;
  markAppearanceOpened: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeName: 'default',
      theme: themes.default,
      fontName: 'jost' as FontName,
      hasOpenedAppearance: false,
      setTheme: (themeName: ThemeName) => {
        const theme = themes[themeName];
        if (theme) {
          const root = document.documentElement;
          Object.entries(theme.cssVars).forEach(([key, value]) => {
            const cssVarName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            root.style.setProperty(`--${cssVarName}`, value as string);
          });
          
          set({ themeName, theme });
        }
      },
      setFont: (fontName: FontName) => {
        applyFont(fontName);
        set({ fontName });
      },
      markAppearanceOpened: () => {
        set({ hasOpenedAppearance: true });
      },
    }),
    {
      name: 'computerzentrale-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const theme = themes[state.themeName];
          if (theme) {
            const root = document.documentElement;
            Object.entries(theme.cssVars).forEach(([key, value]) => {
              const cssVarName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
              root.style.setProperty(`--${cssVarName}`, value as string);
            });
          }
          
          if (state.fontName) {
            applyFont(state.fontName);
          }
        }
      },
    }
  )
);
