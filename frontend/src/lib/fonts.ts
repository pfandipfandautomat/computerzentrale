export interface FontConfig {
  name: string;
  label: string;
  family: string; // CSS font-family value
  weights: string; // Google Fonts weights parameter
  category: 'geometric' | 'humanist' | 'neo-grotesque' | 'monospace' | 'display' | 'serif';
  preview: string; // Short text to preview the font character
}

export const fonts: Record<string, FontConfig> = {
  // — Geometric / Clean —
  jost: {
    name: 'jost',
    label: 'Jost',
    family: "'Jost', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'geometric',
    preview: 'Ag',
  },
  outfit: {
    name: 'outfit',
    label: 'Outfit',
    family: "'Outfit', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'geometric',
    preview: 'Ag',
  },
  urbanist: {
    name: 'urbanist',
    label: 'Urbanist',
    family: "'Urbanist', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'geometric',
    preview: 'Ag',
  },
  raleway: {
    name: 'raleway',
    label: 'Raleway',
    family: "'Raleway', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'geometric',
    preview: 'Ag',
  },
  josefinSans: {
    name: 'josefinSans',
    label: 'Josefin Sans',
    family: "'Josefin Sans', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'geometric',
    preview: 'Ag',
  },
  quicksand: {
    name: 'quicksand',
    label: 'Quicksand',
    family: "'Quicksand', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'geometric',
    preview: 'Ag',
  },
  // — Humanist / Warm —
  plusJakartaSans: {
    name: 'plusJakartaSans',
    label: 'Plus Jakarta Sans',
    family: "'Plus Jakarta Sans', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'humanist',
    preview: 'Ag',
  },
  figtree: {
    name: 'figtree',
    label: 'Figtree',
    family: "'Figtree', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'humanist',
    preview: 'Ag',
  },
  nunito: {
    name: 'nunito',
    label: 'Nunito',
    family: "'Nunito', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'humanist',
    preview: 'Ag',
  },
  rubik: {
    name: 'rubik',
    label: 'Rubik',
    family: "'Rubik', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'humanist',
    preview: 'Ag',
  },
  // — Neo-Grotesque / Sharp —
  instrumentSans: {
    name: 'instrumentSans',
    label: 'Instrument Sans',
    family: "'Instrument Sans', system-ui, sans-serif",
    weights: '400;500;600;700',
    category: 'neo-grotesque',
    preview: 'Ag',
  },
  spaceMono: {
    name: 'spaceMono',
    label: 'Space Mono',
    family: "'Space Mono', monospace",
    weights: '400;700',
    category: 'monospace',
    preview: 'Ag',
  },
  spaceGrotesk: {
    name: 'spaceGrotesk',
    label: 'Space Grotesk',
    family: "'Space Grotesk', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'neo-grotesque',
    preview: 'Ag',
  },
  onest: {
    name: 'onest',
    label: 'Onest',
    family: "'Onest', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'neo-grotesque',
    preview: 'Ag',
  },
  dmSans: {
    name: 'dmSans',
    label: 'DM Sans',
    family: "'DM Sans', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'neo-grotesque',
    preview: 'Ag',
  },
  // — Display / Statement —
  sora: {
    name: 'sora',
    label: 'Sora',
    family: "'Sora', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'display',
    preview: 'Ag',
  },
  lexend: {
    name: 'lexend',
    label: 'Lexend',
    family: "'Lexend', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'display',
    preview: 'Ag',
  },
  exo2: {
    name: 'exo2',
    label: 'Exo 2',
    family: "'Exo 2', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'display',
    preview: 'Ag',
  },
  orbitron: {
    name: 'orbitron',
    label: 'Orbitron',
    family: "'Orbitron', system-ui, sans-serif",
    weights: '400;500;600;700',
    category: 'display',
    preview: 'Ag',
  },
  rajdhani: {
    name: 'rajdhani',
    label: 'Rajdhani',
    family: "'Rajdhani', system-ui, sans-serif",
    weights: '300;400;500;600;700',
    category: 'display',
    preview: 'Ag',
  },
  // — Serif / Editorial —
  sourceSerif4: {
    name: 'sourceSerif4',
    label: 'Source Serif 4',
    family: "'Source Serif 4', Georgia, serif",
    weights: '300;400;500;600;700',
    category: 'serif',
    preview: 'Ag',
  },
  bitter: {
    name: 'bitter',
    label: 'Bitter',
    family: "'Bitter', Georgia, serif",
    weights: '300;400;500;600;700',
    category: 'serif',
    preview: 'Ag',
  },
  // — Monospace / Hacker —
  jetBrainsMono: {
    name: 'jetBrainsMono',
    label: 'JetBrains Mono',
    family: "'JetBrains Mono', monospace",
    weights: '300;400;500;600;700',
    category: 'monospace',
    preview: 'Ag',
  },
  ibmPlexMono: {
    name: 'ibmPlexMono',
    label: 'IBM Plex Mono',
    family: "'IBM Plex Mono', monospace",
    weights: '300;400;500;600;700',
    category: 'monospace',
    preview: 'Ag',
  },
  firaCode: {
    name: 'firaCode',
    label: 'Fira Code',
    family: "'Fira Code', monospace",
    weights: '300;400;500;600;700',
    category: 'monospace',
    preview: 'Ag',
  },
};

export type FontName = keyof typeof fonts;
export const fontNames = Object.keys(fonts) as FontName[];

// Category labels for grouping in the selector
export const FONT_CATEGORIES: Record<string, string> = {
  geometric: 'Geometric',
  humanist: 'Humanist',
  'neo-grotesque': 'Sharp',
  display: 'Display',
  serif: 'Serif',
  monospace: 'Monospace',
};

// Build Google Fonts URL for a font
function buildGoogleFontsUrl(font: FontConfig): string {
  const familyName = font.label.replace(/ /g, '+');
  return `https://fonts.googleapis.com/css2?family=${familyName}:wght@${font.weights}&display=swap`;
}

// Track which fonts have been loaded
const loadedFonts = new Set<string>();

// Dynamically load a Google Font
export function loadFont(fontName: FontName): void {
  if (loadedFonts.has(fontName)) return;
  
  const font = fonts[fontName];
  if (!font) return;
  
  // Jost is already loaded in index.html
  if (fontName === 'jost') {
    loadedFonts.add(fontName);
    return;
  }
  
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = buildGoogleFontsUrl(font);
  document.head.appendChild(link);
  
  loadedFonts.add(fontName);
}

// Apply a font to the document
export function applyFont(fontName: FontName): void {
  const font = fonts[fontName];
  if (!font) return;
  
  loadFont(fontName);
  document.documentElement.style.setProperty('--font-sans', font.family);
}
