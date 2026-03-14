import { useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useThemeStore } from '@/stores/useThemeStore';
import { themes, themeNames } from '@/lib/themes';
import { fonts, fontNames, FONT_CATEGORIES, loadFont, type FontName } from '@/lib/fonts';
import { cn } from '@/lib/utils';

function hslToCSS(hsl: string): string {
  return `hsl(${hsl})`;
}

// Preload a font when hovering over it
function handleFontHover(name: FontName) {
  loadFont(name);
}

export function AppearancePopover() {
  const { themeName, setTheme, fontName, setFont, hasOpenedAppearance, markAppearanceOpened } = useThemeStore();
  const [open, setOpen] = useState(false);
  const currentTheme = themes[themeName];

  // Group fonts by category
  const fontsByCategory = fontNames.reduce((acc, name) => {
    const font = fonts[name];
    if (!acc[font.category]) acc[font.category] = [];
    acc[font.category].push(name);
    return acc;
  }, {} as Record<string, FontName[]>);

  const categoryOrder = ['geometric', 'humanist', 'neo-grotesque', 'display', 'monospace', 'serif'];

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v && !hasOpenedAppearance) markAppearanceOpened(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-secondary relative",
            open && "text-foreground bg-secondary/80"
          )}
          title="Appearance"
        >
          <Palette className="h-4 w-4" />
          {/* Discovery dot — only shown until user opens the popover for the first time */}
          {!hasOpenedAppearance && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-card animate-pulse"
              style={{ background: hslToCSS(currentTheme.cssVars.primary) }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[340px] p-0 bg-card/98 backdrop-blur-xl border-border/50 shadow-2xl shadow-black/40 ring-1 ring-white/5"
      >
        {/* Theme Section */}
        <div className="p-4 pb-3">
          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-3">
            Theme
          </h4>
          <div className="grid grid-cols-7 gap-1.5">
            {themeNames.map((name) => {
              const theme = themes[name];
              const isActive = name === themeName;
              return (
                <button
                  key={name}
                  onClick={() => setTheme(name as any)}
                  title={theme.label}
                  className={cn(
                    "group relative h-7 rounded-md overflow-hidden transition-all duration-150",
                    "hover:scale-110 hover:z-10 hover:shadow-lg hover:shadow-black/30",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive && "ring-2 ring-primary ring-offset-1 ring-offset-card scale-110 z-10"
                  )}
                >
                  {/* 3-color swatch */}
                  <div className="flex h-full">
                    <div className="flex-1" style={{ background: hslToCSS(theme.cssVars.background) }} />
                    <div className="flex-1" style={{ background: hslToCSS(theme.cssVars.primary) }} />
                    <div className="flex-1" style={{ background: hslToCSS(theme.cssVars.accent) }} />
                  </div>
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Check className="h-3 w-3 text-white drop-shadow-md" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-border/40" />

        {/* Font Section */}
        <div className="p-4 pt-3">
          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-3">
            Font
          </h4>
          <div className="max-h-[240px] overflow-y-auto scrollbar-thin space-y-3 -mr-2 pr-2">
            {categoryOrder.map((category) => {
              const fontsInCategory = fontsByCategory[category];
              if (!fontsInCategory || fontsInCategory.length === 0) return null;

              return (
                <div key={category}>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40 font-medium mb-1 pl-2">
                    {FONT_CATEGORIES[category]}
                  </p>
                  <div className="space-y-0.5">
                    {fontsInCategory.map((name) => {
                      const font = fonts[name];
                      const isActive = name === fontName;
                      return (
                        <button
                          key={name}
                          onClick={() => setFont(name)}
                          onMouseEnter={() => handleFontHover(name)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded-md text-sm transition-all duration-150",
                            "hover:bg-secondary/50",
                            isActive
                              ? "bg-secondary/70 text-foreground border-l-2 border-primary"
                              : "text-foreground/80 border-l-2 border-transparent"
                          )}
                          style={{ fontFamily: font.family }}
                        >
                          {font.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
