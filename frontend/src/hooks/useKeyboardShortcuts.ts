import { useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const matchingShortcut = shortcuts.find(shortcut => {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrl === undefined || event.ctrlKey === shortcut.ctrl;
        const altMatches = shortcut.alt === undefined || event.altKey === shortcut.alt;
        const shiftMatches = shortcut.shift === undefined || event.shiftKey === shortcut.shift;
        const metaMatches = shortcut.meta === undefined || event.metaKey === shortcut.meta;

        return keyMatches && ctrlMatches && altMatches && shiftMatches && metaMatches;
      });

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Console easter egg for developers
export function logEasterEgg() {
  const styles = {
    title: 'color: #3b82f6; font-size: 20px; font-weight: bold; text-shadow: 0 0 10px rgba(59,130,246,0.5);',
    subtitle: 'color: #60a5fa; font-size: 14px;',
    text: 'color: #94a3b8;',
    command: 'color: #10b981; font-family: monospace; background: rgba(16,185,129,0.1); padding: 2px 6px; border-radius: 3px;',
  };

  console.log('%c⚡ Computerzentrale', styles.title);
  console.log('%cHacker. ULTRADESIGN. Elitist.', styles.subtitle);
  console.log('%c\nKeyboard Shortcuts:', styles.text);
  console.log('%c  Ctrl + K       %c→  Quick Actions', styles.command, styles.text);
  console.log('%c  Ctrl + R       %c→  Refresh All Nodes', styles.command, styles.text);
  console.log('%c  Ctrl + N       %c→  Add New Node', styles.command, styles.text);
  console.log('%c  /              %c→  Focus Search', styles.command, styles.text);
  console.log('%c  ?              %c→  Show Shortcuts', styles.command, styles.text);
  console.log('%c\n👀 You\'re a curious one. Like what you see?', styles.text);
}
