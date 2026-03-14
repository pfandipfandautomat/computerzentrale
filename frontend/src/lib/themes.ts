export interface Theme {
  name: string;
  label: string;
  cssVars: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
    statusOnline: string;
    statusOffline: string;
    statusUnknown: string;
  };
  terminal: {
    background: string;
    foreground: string;
    cursor: string;
    cursorAccent: string;
    selectionBackground: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
}

// Helper to convert hex to HSL string for CSS variables
function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function adjustBrightness(hex: string, factor: number): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Compute relative luminance for WCAG contrast calculation
function hexToLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const linearize = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

// Compute WCAG contrast ratio between two hex colors
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Mix two hex colors by a factor (0 = color1, 1 = color2)
function mixColors(hex1: string, hex2: string, factor: number): string {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  
  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Ensure a color has minimum contrast against a background
// Progressively blends toward foreground until contrast threshold is met
function ensureContrast(color: string, background: string, foreground: string, minRatio: number = 4.5): string {
  if (contrastRatio(color, background) >= minRatio) {
    return color;
  }
  
  // Binary search for the minimum blend factor that meets contrast
  let low = 0;
  let high = 1;
  
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    const mixed = mixColors(color, foreground, mid);
    
    if (contrastRatio(mixed, background) >= minRatio) {
      high = mid;
    } else {
      low = mid;
    }
  }
  
  return mixColors(color, foreground, high);
}

// Helper to create theme from terminal colors
function createTheme(
  name: string,
  label: string,
  terminal: Theme['terminal'],
  primaryColor?: string,
  accentColor?: string
): Theme {
  const primary = primaryColor || terminal.blue;
  const accent = accentColor || terminal.magenta;
  
  return {
    name,
    label,
    cssVars: {
      background: hexToHSL(terminal.background),
      foreground: hexToHSL(terminal.foreground),
      card: hexToHSL(adjustBrightness(terminal.background, 1.15)),
      cardForeground: hexToHSL(terminal.foreground),
      popover: hexToHSL(adjustBrightness(terminal.background, 1.15)),
      popoverForeground: hexToHSL(terminal.foreground),
      primary: hexToHSL(primary),
      primaryForeground: hexToHSL(terminal.background),
      secondary: hexToHSL(adjustBrightness(terminal.background, 1.4)),
      secondaryForeground: hexToHSL(terminal.foreground),
      muted: hexToHSL(adjustBrightness(terminal.background, 1.25)),
      mutedForeground: hexToHSL(ensureContrast(terminal.brightBlack, terminal.background, terminal.foreground, 4.5)),
      accent: hexToHSL(accent),
      accentForeground: hexToHSL(terminal.background),
      destructive: hexToHSL(terminal.red),
      destructiveForeground: hexToHSL(terminal.background),
      border: hexToHSL(ensureContrast(adjustBrightness(terminal.background, 1.5), terminal.background, terminal.foreground, 1.5)),
      input: hexToHSL(ensureContrast(adjustBrightness(terminal.background, 1.5), terminal.background, terminal.foreground, 1.5)),
      ring: hexToHSL(primary),
      statusOnline: hexToHSL(terminal.green),
      statusOffline: hexToHSL(terminal.red),
      statusUnknown: hexToHSL(terminal.brightBlack),
    },
    terminal,
  };
}

export const themes: Record<string, Theme> = {
  // Default theme
  default: createTheme('default', 'Default', {
    background: '#0a0f1a',
    foreground: '#e4e4e7',
    cursor: '#e4e4e7',
    cursorAccent: '#0a0f1a',
    selectionBackground: '#3f3f46',
    black: '#18181b',
    red: '#ef4444',
    green: '#22c55e',
    yellow: '#eab308',
    blue: '#3b82f6',
    magenta: '#a855f7',
    cyan: '#06b6d4',
    white: '#e4e4e7',
    brightBlack: '#52525b',
    brightRed: '#f87171',
    brightGreen: '#4ade80',
    brightYellow: '#facc15',
    brightBlue: '#60a5fa',
    brightMagenta: '#c084fc',
    brightCyan: '#22d3ee',
    brightWhite: '#fafafa',
  }),

  // Apprentice
  apprentice: createTheme('apprentice', 'Apprentice', {
    background: '#262626',
    foreground: '#bcbcbc',
    cursor: '#bcbcbc',
    cursorAccent: '#262626',
    selectionBackground: '#444444',
    black: '#1c1c1c',
    red: '#af5f5f',
    green: '#5f875f',
    yellow: '#87875f',
    blue: '#5f87af',
    magenta: '#5f5f87',
    cyan: '#5f8787',
    white: '#6c6c6c',
    brightBlack: '#444444',
    brightRed: '#ff8700',
    brightGreen: '#87af87',
    brightYellow: '#ffffaf',
    brightBlue: '#8fafd7',
    brightMagenta: '#8787af',
    brightCyan: '#5fafaf',
    brightWhite: '#ffffff',
  }),

  // Ayu Dark
  ayuDark: createTheme('ayuDark', 'Ayu Dark', {
    background: '#0a0e14',
    foreground: '#b3b1ad',
    cursor: '#e6b450',
    cursorAccent: '#0a0e14',
    selectionBackground: '#273747',
    black: '#01060e',
    red: '#ea6c73',
    green: '#91b362',
    yellow: '#f9af4f',
    blue: '#53bdfa',
    magenta: '#fae994',
    cyan: '#90e1c6',
    white: '#c7c7c7',
    brightBlack: '#686868',
    brightRed: '#f07178',
    brightGreen: '#c2d94c',
    brightYellow: '#ffb454',
    brightBlue: '#59c2ff',
    brightMagenta: '#ffee99',
    brightCyan: '#95e6cb',
    brightWhite: '#ffffff',
  }, '#e6b450', '#53bdfa'),

  // Ayu Mirage
  ayuMirage: createTheme('ayuMirage', 'Ayu Mirage', {
    background: '#1f2430',
    foreground: '#cbccc6',
    cursor: '#ffcc66',
    cursorAccent: '#1f2430',
    selectionBackground: '#34455a',
    black: '#191e2a',
    red: '#ed8274',
    green: '#a6cc70',
    yellow: '#fad07b',
    blue: '#6dcbfa',
    magenta: '#cfbafa',
    cyan: '#90e1c6',
    white: '#c7c7c7',
    brightBlack: '#686868',
    brightRed: '#f28779',
    brightGreen: '#bae67e',
    brightYellow: '#ffd580',
    brightBlue: '#73d0ff',
    brightMagenta: '#d4bfff',
    brightCyan: '#95e6cb',
    brightWhite: '#ffffff',
  }, '#ffcc66', '#73d0ff'),

  // Catppuccin Mocha
  catppuccinMocha: createTheme('catppuccinMocha', 'Catppuccin Mocha', {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    cursorAccent: '#1e1e2e',
    selectionBackground: '#45475a',
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#f5c2e7',
    cyan: '#94e2d5',
    white: '#bac2de',
    brightBlack: '#585b70',
    brightRed: '#f38ba8',
    brightGreen: '#a6e3a1',
    brightYellow: '#f9e2af',
    brightBlue: '#89b4fa',
    brightMagenta: '#f5c2e7',
    brightCyan: '#94e2d5',
    brightWhite: '#a6adc8',
  }, '#cba6f7', '#f5c2e7'),

  // Catppuccin Macchiato
  catppuccinMacchiato: createTheme('catppuccinMacchiato', 'Catppuccin Macchiato', {
    background: '#24273a',
    foreground: '#cad3f5',
    cursor: '#f4dbd6',
    cursorAccent: '#24273a',
    selectionBackground: '#494d64',
    black: '#494d64',
    red: '#ed8796',
    green: '#a6da95',
    yellow: '#eed49f',
    blue: '#8aadf4',
    magenta: '#f5bde6',
    cyan: '#8bd5ca',
    white: '#b8c0e0',
    brightBlack: '#5b6078',
    brightRed: '#ed8796',
    brightGreen: '#a6da95',
    brightYellow: '#eed49f',
    brightBlue: '#8aadf4',
    brightMagenta: '#f5bde6',
    brightCyan: '#8bd5ca',
    brightWhite: '#a5adcb',
  }, '#c6a0f6', '#f5bde6'),

  // Catppuccin Frappe
  catppuccinFrappe: createTheme('catppuccinFrappe', 'Catppuccin Frappé', {
    background: '#303446',
    foreground: '#c6d0f5',
    cursor: '#f2d5cf',
    cursorAccent: '#303446',
    selectionBackground: '#51576d',
    black: '#51576d',
    red: '#e78284',
    green: '#a6d189',
    yellow: '#e5c890',
    blue: '#8caaee',
    magenta: '#f4b8e4',
    cyan: '#81c8be',
    white: '#b5bfe2',
    brightBlack: '#626880',
    brightRed: '#e78284',
    brightGreen: '#a6d189',
    brightYellow: '#e5c890',
    brightBlue: '#8caaee',
    brightMagenta: '#f4b8e4',
    brightCyan: '#81c8be',
    brightWhite: '#a5adce',
  }, '#ca9ee6', '#f4b8e4'),

  // Cobalt2
  cobalt2: createTheme('cobalt2', 'Cobalt2', {
    background: '#193549',
    foreground: '#ffffff',
    cursor: '#ffc600',
    cursorAccent: '#193549',
    selectionBackground: '#0d3a58',
    black: '#000000',
    red: '#ff0000',
    green: '#38de21',
    yellow: '#ffe50a',
    blue: '#1460d2',
    magenta: '#ff005d',
    cyan: '#00bbbb',
    white: '#bbbbbb',
    brightBlack: '#555555',
    brightRed: '#f40e17',
    brightGreen: '#3bd01d',
    brightYellow: '#edc809',
    brightBlue: '#5555ff',
    brightMagenta: '#ff55ff',
    brightCyan: '#6ae3fa',
    brightWhite: '#ffffff',
  }, '#ffc600', '#ff005d'),

  // Dracula
  dracula: createTheme('dracula', 'Dracula', {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#282a36',
    selectionBackground: '#44475a',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  }, '#bd93f9', '#ff79c6'),

  // Everforest Dark
  everforest: createTheme('everforest', 'Everforest Dark', {
    background: '#2d353b',
    foreground: '#d3c6aa',
    cursor: '#d3c6aa',
    cursorAccent: '#2d353b',
    selectionBackground: '#475258',
    black: '#475258',
    red: '#e67e80',
    green: '#a7c080',
    yellow: '#dbbc7f',
    blue: '#7fbbb3',
    magenta: '#d699b6',
    cyan: '#83c092',
    white: '#d3c6aa',
    brightBlack: '#475258',
    brightRed: '#e67e80',
    brightGreen: '#a7c080',
    brightYellow: '#dbbc7f',
    brightBlue: '#7fbbb3',
    brightMagenta: '#d699b6',
    brightCyan: '#83c092',
    brightWhite: '#d3c6aa',
  }, '#a7c080', '#d699b6'),

  // GitHub Dark
  githubDark: createTheme('githubDark', 'GitHub Dark', {
    background: '#0d1117',
    foreground: '#c9d1d9',
    cursor: '#c9d1d9',
    cursorAccent: '#0d1117',
    selectionBackground: '#3b5070',
    black: '#484f58',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#b1bac4',
    brightBlack: '#6e7681',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#f0f6fc',
  }, '#58a6ff', '#bc8cff'),

  // GitHub Dark Dimmed
  githubDarkDimmed: createTheme('githubDarkDimmed', 'GitHub Dark Dimmed', {
    background: '#22272e',
    foreground: '#adbac7',
    cursor: '#adbac7',
    cursorAccent: '#22272e',
    selectionBackground: '#3d4752',
    black: '#545d68',
    red: '#f47067',
    green: '#57ab5a',
    yellow: '#c69026',
    blue: '#539bf5',
    magenta: '#b083f0',
    cyan: '#39c5cf',
    white: '#909dab',
    brightBlack: '#636e7b',
    brightRed: '#ff938a',
    brightGreen: '#6bc46d',
    brightYellow: '#daaa3f',
    brightBlue: '#6cb6ff',
    brightMagenta: '#dcbdfb',
    brightCyan: '#56d4dd',
    brightWhite: '#cdd9e5',
  }, '#539bf5', '#b083f0'),

  // Gotham
  gotham: createTheme('gotham', 'Gotham', {
    background: '#0a0f14',
    foreground: '#98d1ce',
    cursor: '#98d1ce',
    cursorAccent: '#0a0f14',
    selectionBackground: '#091f2e',
    black: '#0a0f14',
    red: '#c33027',
    green: '#26a98b',
    yellow: '#edb54b',
    blue: '#195465',
    magenta: '#4e5165',
    cyan: '#33859d',
    white: '#98d1ce',
    brightBlack: '#10151b',
    brightRed: '#d26939',
    brightGreen: '#081f2d',
    brightYellow: '#245361',
    brightBlue: '#093748',
    brightMagenta: '#888ba5',
    brightCyan: '#599caa',
    brightWhite: '#d3ebe9',
  }, '#33859d', '#edb54b'),

  // Gruvbox Dark
  gruvbox: createTheme('gruvbox', 'Gruvbox Dark', {
    background: '#282828',
    foreground: '#ebdbb2',
    cursor: '#ebdbb2',
    cursorAccent: '#282828',
    selectionBackground: '#504945',
    black: '#282828',
    red: '#cc241d',
    green: '#98971a',
    yellow: '#d79921',
    blue: '#458588',
    magenta: '#b16286',
    cyan: '#689d6a',
    white: '#a89984',
    brightBlack: '#928374',
    brightRed: '#fb4934',
    brightGreen: '#b8bb26',
    brightYellow: '#fabd2f',
    brightBlue: '#83a598',
    brightMagenta: '#d3869b',
    brightCyan: '#8ec07c',
    brightWhite: '#ebdbb2',
  }, '#fe8019', '#b8bb26'),

  // Iceberg Dark
  iceberg: createTheme('iceberg', 'Iceberg Dark', {
    background: '#161821',
    foreground: '#c6c8d1',
    cursor: '#c6c8d1',
    cursorAccent: '#161821',
    selectionBackground: '#3d435c',
    black: '#161821',
    red: '#e27878',
    green: '#b4be82',
    yellow: '#e2a478',
    blue: '#84a0c6',
    magenta: '#a093c7',
    cyan: '#89b8c2',
    white: '#c6c8d1',
    brightBlack: '#6b7089',
    brightRed: '#e98989',
    brightGreen: '#c0ca8e',
    brightYellow: '#e9b189',
    brightBlue: '#91acd1',
    brightMagenta: '#ada0d3',
    brightCyan: '#95c4ce',
    brightWhite: '#d2d4de',
  }, '#84a0c6', '#a093c7'),

  // Jellybeans
  jellybeans: createTheme('jellybeans', 'Jellybeans', {
    background: '#151515',
    foreground: '#e8e8d3',
    cursor: '#b0d0f0',
    cursorAccent: '#151515',
    selectionBackground: '#404040',
    black: '#3b3b3b',
    red: '#cf6a4c',
    green: '#99ad6a',
    yellow: '#d8ad4c',
    blue: '#597bc5',
    magenta: '#a037b0',
    cyan: '#71b9f8',
    white: '#adadad',
    brightBlack: '#636363',
    brightRed: '#f79274',
    brightGreen: '#c3d599',
    brightYellow: '#ffd75f',
    brightBlue: '#85add4',
    brightMagenta: '#b76eb8',
    brightCyan: '#8fbfdc',
    brightWhite: '#e8e8d3',
  }, '#71b9f8', '#a037b0'),

  // Kanagawa
  kanagawa: createTheme('kanagawa', 'Kanagawa', {
    background: '#1f1f28',
    foreground: '#dcd7ba',
    cursor: '#c8c093',
    cursorAccent: '#1f1f28',
    selectionBackground: '#2d4f67',
    black: '#090618',
    red: '#c34043',
    green: '#76946a',
    yellow: '#c0a36e',
    blue: '#7e9cd8',
    magenta: '#957fb8',
    cyan: '#6a9589',
    white: '#c8c093',
    brightBlack: '#727169',
    brightRed: '#e82424',
    brightGreen: '#98bb6c',
    brightYellow: '#e6c384',
    brightBlue: '#7fb4ca',
    brightMagenta: '#938aa9',
    brightCyan: '#7aa89f',
    brightWhite: '#dcd7ba',
  }, '#7e9cd8', '#957fb8'),

  // Lucario
  lucario: createTheme('lucario', 'Lucario', {
    background: '#2b3e50',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#2b3e50',
    selectionBackground: '#19242f',
    black: '#2b3e50',
    red: '#e6454b',
    green: '#72c05d',
    yellow: '#e5c454',
    blue: '#66d9ee',
    magenta: '#9e7fd5',
    cyan: '#66d9ee',
    white: '#f8f8f2',
    brightBlack: '#5c98cd',
    brightRed: '#e6454b',
    brightGreen: '#72c05d',
    brightYellow: '#e5c454',
    brightBlue: '#66d9ee',
    brightMagenta: '#9e7fd5',
    brightCyan: '#66d9ee',
    brightWhite: '#f8f8f2',
  }, '#66d9ee', '#9e7fd5'),

  // Moonfly
  moonfly: createTheme('moonfly', 'Moonfly', {
    background: '#080808',
    foreground: '#b2b2b2',
    cursor: '#9e9e9e',
    cursorAccent: '#080808',
    selectionBackground: '#b2ceee',
    black: '#323437',
    red: '#ff5454',
    green: '#8cc85f',
    yellow: '#e3c78a',
    blue: '#80a0ff',
    magenta: '#cf87e8',
    cyan: '#79dac8',
    white: '#c6c6c6',
    brightBlack: '#949494',
    brightRed: '#ff5189',
    brightGreen: '#36c692',
    brightYellow: '#bfbf97',
    brightBlue: '#74b2ff',
    brightMagenta: '#ae81ff',
    brightCyan: '#85dc85',
    brightWhite: '#e4e4e4',
  }, '#80a0ff', '#cf87e8'),

  // Night Owl
  nightOwl: createTheme('nightOwl', 'Night Owl', {
    background: '#011627',
    foreground: '#d6deeb',
    cursor: '#80a4c2',
    cursorAccent: '#011627',
    selectionBackground: '#1d3b53',
    black: '#011627',
    red: '#ef5350',
    green: '#22da6e',
    yellow: '#addb67',
    blue: '#82aaff',
    magenta: '#c792ea',
    cyan: '#21c7a8',
    white: '#ffffff',
    brightBlack: '#575656',
    brightRed: '#ef5350',
    brightGreen: '#22da6e',
    brightYellow: '#ffeb95',
    brightBlue: '#82aaff',
    brightMagenta: '#c792ea',
    brightCyan: '#7fdbca',
    brightWhite: '#ffffff',
  }, '#82aaff', '#c792ea'),

  // Nightfly
  nightfly: createTheme('nightfly', 'Nightfly', {
    background: '#011627',
    foreground: '#acb4c2',
    cursor: '#9ca1aa',
    cursorAccent: '#011627',
    selectionBackground: '#b2ceee',
    black: '#1d3b53',
    red: '#fc514e',
    green: '#a1cd5e',
    yellow: '#e3d18a',
    blue: '#82aaff',
    magenta: '#c792ea',
    cyan: '#7fdbca',
    white: '#a1aab8',
    brightBlack: '#7c8f8f',
    brightRed: '#ff5874',
    brightGreen: '#21c7a8',
    brightYellow: '#ecc48d',
    brightBlue: '#82aaff',
    brightMagenta: '#ae81ff',
    brightCyan: '#7fdbca',
    brightWhite: '#d6deeb',
  }, '#82aaff', '#c792ea'),

  // Nord
  nord: createTheme('nord', 'Nord', {
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#d8dee9',
    cursorAccent: '#2e3440',
    selectionBackground: '#434c5e',
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#bf616a',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4',
  }, '#88c0d0', '#b48ead'),

  // One Dark
  oneDark: createTheme('oneDark', 'One Dark', {
    background: '#282c34',
    foreground: '#abb2bf',
    cursor: '#528bff',
    cursorAccent: '#282c34',
    selectionBackground: '#3e4451',
    black: '#282c34',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#e5c07b',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#e5c07b',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
  }, '#61afef', '#c678dd'),

  // One Half Dark
  oneHalfDark: createTheme('oneHalfDark', 'One Half Dark', {
    background: '#282c34',
    foreground: '#dcdfe4',
    cursor: '#a3b3cc',
    cursorAccent: '#282c34',
    selectionBackground: '#474e5d',
    black: '#282c34',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#e5c07b',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#dcdfe4',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#e5c07b',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#dcdfe4',
  }, '#61afef', '#c678dd'),

  // Panda
  panda: createTheme('panda', 'Panda', {
    background: '#292a2b',
    foreground: '#e6e6e6',
    cursor: '#f0eeee',
    cursorAccent: '#292a2b',
    selectionBackground: '#45454a',
    black: '#292a2b',
    red: '#ff2c6d',
    green: '#19f9d8',
    yellow: '#ffb86c',
    blue: '#45a9f9',
    magenta: '#ff75b5',
    cyan: '#6fc1ff',
    white: '#e6e6e6',
    brightBlack: '#757575',
    brightRed: '#ff9ac1',
    brightGreen: '#19f9d8',
    brightYellow: '#ffcc95',
    brightBlue: '#6fc1ff',
    brightMagenta: '#ff9ac1',
    brightCyan: '#6fc1ff',
    brightWhite: '#ffffff',
  }, '#19f9d8', '#ff75b5'),

  // Rosé Pine
  rosePine: createTheme('rosePine', 'Rosé Pine', {
    background: '#191724',
    foreground: '#e0def4',
    cursor: '#524f67',
    cursorAccent: '#e0def4',
    selectionBackground: '#2a283e',
    black: '#26233a',
    red: '#eb6f92',
    green: '#31748f',
    yellow: '#f6c177',
    blue: '#9ccfd8',
    magenta: '#c4a7e7',
    cyan: '#ebbcba',
    white: '#e0def4',
    brightBlack: '#6e6a86',
    brightRed: '#eb6f92',
    brightGreen: '#31748f',
    brightYellow: '#f6c177',
    brightBlue: '#9ccfd8',
    brightMagenta: '#c4a7e7',
    brightCyan: '#ebbcba',
    brightWhite: '#e0def4',
  }, '#c4a7e7', '#eb6f92'),

  // Rosé Pine Moon
  rosePineMoon: createTheme('rosePineMoon', 'Rosé Pine Moon', {
    background: '#232136',
    foreground: '#e0def4',
    cursor: '#59546d',
    cursorAccent: '#e0def4',
    selectionBackground: '#393552',
    black: '#393552',
    red: '#eb6f92',
    green: '#3e8fb0',
    yellow: '#f6c177',
    blue: '#9ccfd8',
    magenta: '#c4a7e7',
    cyan: '#ea9a97',
    white: '#e0def4',
    brightBlack: '#6e6a86',
    brightRed: '#eb6f92',
    brightGreen: '#3e8fb0',
    brightYellow: '#f6c177',
    brightBlue: '#9ccfd8',
    brightMagenta: '#c4a7e7',
    brightCyan: '#ea9a97',
    brightWhite: '#e0def4',
  }, '#c4a7e7', '#eb6f92'),

  // Shades of Purple
  shadesOfPurple: createTheme('shadesOfPurple', 'Shades of Purple', {
    background: '#1e1e3f',
    foreground: '#ffffff',
    cursor: '#fad000',
    cursorAccent: '#1e1e3f',
    selectionBackground: '#2d2b55',
    black: '#000000',
    red: '#ec3a37',
    green: '#3ad900',
    yellow: '#fad000',
    blue: '#6943ff',
    magenta: '#ff2c70',
    cyan: '#00c5c7',
    white: '#c7c7c7',
    brightBlack: '#686868',
    brightRed: '#ec3a37',
    brightGreen: '#3ad900',
    brightYellow: '#fad000',
    brightBlue: '#6943ff',
    brightMagenta: '#ff2c70',
    brightCyan: '#00c5c7',
    brightWhite: '#ffffff',
  }, '#6943ff', '#ff2c70'),

  // Solarized Dark
  solarizedDark: createTheme('solarizedDark', 'Solarized Dark', {
    background: '#002b36',
    foreground: '#839496',
    cursor: '#839496',
    cursorAccent: '#002b36',
    selectionBackground: '#073642',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#002b36',
    brightRed: '#cb4b16',
    brightGreen: '#586e75',
    brightYellow: '#657b83',
    brightBlue: '#839496',
    brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1',
    brightWhite: '#fdf6e3',
  }, '#268bd2', '#d33682'),

  // Srcery
  srcery: createTheme('srcery', 'Srcery', {
    background: '#1c1b19',
    foreground: '#fce8c3',
    cursor: '#fbb829',
    cursorAccent: '#1c1b19',
    selectionBackground: '#2d2c29',
    black: '#1c1b19',
    red: '#ef2f27',
    green: '#519f50',
    yellow: '#fbb829',
    blue: '#2c78bf',
    magenta: '#e02c6d',
    cyan: '#0aaeb3',
    white: '#918175',
    brightBlack: '#2d2c29',
    brightRed: '#f75341',
    brightGreen: '#98bc37',
    brightYellow: '#fed06e',
    brightBlue: '#68a8e4',
    brightMagenta: '#ff5c8f',
    brightCyan: '#53fde9',
    brightWhite: '#fce8c3',
  }, '#fbb829', '#e02c6d'),

  // Tender
  tender: createTheme('tender', 'Tender', {
    background: '#282828',
    foreground: '#eeeeee',
    cursor: '#eeeeee',
    cursorAccent: '#282828',
    selectionBackground: '#444444',
    black: '#282828',
    red: '#f43753',
    green: '#c9d05c',
    yellow: '#ffc24b',
    blue: '#b3deef',
    magenta: '#d3b987',
    cyan: '#73cef4',
    white: '#eeeeee',
    brightBlack: '#484848',
    brightRed: '#f43753',
    brightGreen: '#c9d05c',
    brightYellow: '#ffc24b',
    brightBlue: '#b3deef',
    brightMagenta: '#d3b987',
    brightCyan: '#73cef4',
    brightWhite: '#ffffff',
  }, '#73cef4', '#d3b987'),

  // Tokyo Night
  tokyoNight: createTheme('tokyoNight', 'Tokyo Night', {
    background: '#1a1b26',
    foreground: '#c0caf5',
    cursor: '#c0caf5',
    cursorAccent: '#1a1b26',
    selectionBackground: '#33467c',
    black: '#15161e',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#a9b1d6',
    brightBlack: '#414868',
    brightRed: '#f7768e',
    brightGreen: '#9ece6a',
    brightYellow: '#e0af68',
    brightBlue: '#7aa2f7',
    brightMagenta: '#bb9af7',
    brightCyan: '#7dcfff',
    brightWhite: '#c0caf5',
  }, '#7aa2f7', '#bb9af7'),

  // Tokyo Night Storm
  tokyoNightStorm: createTheme('tokyoNightStorm', 'Tokyo Night Storm', {
    background: '#24283b',
    foreground: '#c0caf5',
    cursor: '#c0caf5',
    cursorAccent: '#24283b',
    selectionBackground: '#2e3c64',
    black: '#1d202f',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#a9b1d6',
    brightBlack: '#414868',
    brightRed: '#f7768e',
    brightGreen: '#9ece6a',
    brightYellow: '#e0af68',
    brightBlue: '#7aa2f7',
    brightMagenta: '#bb9af7',
    brightCyan: '#7dcfff',
    brightWhite: '#c0caf5',
  }, '#7aa2f7', '#bb9af7'),

  // Tomorrow Night
  tomorrowNight: createTheme('tomorrowNight', 'Tomorrow Night', {
    background: '#1d1f21',
    foreground: '#c5c8c6',
    cursor: '#c5c8c6',
    cursorAccent: '#1d1f21',
    selectionBackground: '#373b41',
    black: '#1d1f21',
    red: '#cc6666',
    green: '#b5bd68',
    yellow: '#f0c674',
    blue: '#81a2be',
    magenta: '#b294bb',
    cyan: '#8abeb7',
    white: '#c5c8c6',
    brightBlack: '#969896',
    brightRed: '#cc6666',
    brightGreen: '#b5bd68',
    brightYellow: '#f0c674',
    brightBlue: '#81a2be',
    brightMagenta: '#b294bb',
    brightCyan: '#8abeb7',
    brightWhite: '#ffffff',
  }, '#81a2be', '#b294bb'),

  // Tomorrow Night Eighties
  tomorrowNightEighties: createTheme('tomorrowNightEighties', 'Tomorrow Night Eighties', {
    background: '#2d2d2d',
    foreground: '#cccccc',
    cursor: '#cccccc',
    cursorAccent: '#2d2d2d',
    selectionBackground: '#515151',
    black: '#2d2d2d',
    red: '#f2777a',
    green: '#99cc99',
    yellow: '#ffcc66',
    blue: '#6699cc',
    magenta: '#cc99cc',
    cyan: '#66cccc',
    white: '#cccccc',
    brightBlack: '#999999',
    brightRed: '#f2777a',
    brightGreen: '#99cc99',
    brightYellow: '#ffcc66',
    brightBlue: '#6699cc',
    brightMagenta: '#cc99cc',
    brightCyan: '#66cccc',
    brightWhite: '#ffffff',
  }, '#6699cc', '#cc99cc'),
};

export const themeNames = Object.keys(themes) as (keyof typeof themes)[];
export type ThemeName = keyof typeof themes;
