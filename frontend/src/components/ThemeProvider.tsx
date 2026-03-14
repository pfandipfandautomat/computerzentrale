import { useEffect } from 'react';
import { useThemeStore } from '@/stores/useThemeStore';
import { themes } from '@/lib/themes';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { themeName } = useThemeStore();

  // Apply theme on mount and when theme changes
  useEffect(() => {
    const theme = themes[themeName];
    if (theme) {
      const root = document.documentElement;
      Object.entries(theme.cssVars).forEach(([key, value]) => {
        // Convert camelCase to kebab-case for CSS variable names
        const cssVarName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        root.style.setProperty(`--${cssVarName}`, value);
      });
    }
  }, [themeName]);

  return <>{children}</>;
}
