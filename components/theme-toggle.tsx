'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const selectedTheme = mounted ? theme : undefined;
  const selectedIndex = selectedTheme === 'light' ? 0 : selectedTheme === 'dark' ? 1 : 2;

  return (
    <div
      aria-label="Color theme"
      className="relative grid h-11 w-[7.25rem] grid-cols-3 items-center rounded-full border border-border bg-muted p-1"
      role="group"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-1 top-1 size-9 rounded-full bg-background shadow-sm will-change-transform motion-reduce:transition-none ${mounted ? 'transition-transform duration-300 ease-in-out' : 'transition-none'}`}
        style={{ transform: `translateX(${selectedIndex * 100}%)` }}
      />
      <button
        aria-label="Use light theme"
        aria-pressed={selectedTheme === 'light'}
        className={`relative z-10 grid size-9 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedTheme === 'light' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        onClick={() => setTheme('light')}
        title="Light theme"
        type="button"
      >
        <Sun aria-hidden="true" className="size-4" />
      </button>
      <button
        aria-label="Use dark theme"
        aria-pressed={selectedTheme === 'dark'}
        className={`relative z-10 grid size-9 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedTheme === 'dark' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        onClick={() => setTheme('dark')}
        title="Dark theme"
        type="button"
      >
        <Moon aria-hidden="true" className="size-4" />
      </button>
      <button
        aria-label="Use system theme"
        aria-pressed={selectedTheme === 'system'}
        className={`relative z-10 grid size-9 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedTheme === 'system' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        onClick={() => setTheme('system')}
        title="Follow system theme"
        type="button"
      >
        <Monitor aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}