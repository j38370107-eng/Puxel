import { useEffect } from 'react';

export const useKeyboardShortcuts = (
  shortcuts: { key: string; ctrlKey?: boolean; shiftKey?: boolean; action: () => void }[]
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      for (const shortcut of shortcuts) {
        const matchCtrl = shortcut.ctrlKey === undefined ? true : !!e.ctrlKey === !!shortcut.ctrlKey || !!e.metaKey === !!shortcut.ctrlKey;
        const matchShift = shortcut.shiftKey === undefined ? true : !!e.shiftKey === !!shortcut.shiftKey;
        if (e.key.toLowerCase() === shortcut.key.toLowerCase() && matchCtrl && matchShift) {
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};
