import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAppTheme } from './use-theme';

let systemTheme: MediaQueryList;
let setSystemTheme: (isDark: boolean) => void;

beforeEach(() => {
  const events = new window.EventTarget();
  systemTheme = {
    matches: false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(events.addEventListener.bind(events)),
    removeEventListener: vi.fn(events.removeEventListener.bind(events)),
    dispatchEvent: events.dispatchEvent.bind(events),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => systemTheme)
  );
  setSystemTheme = (isDark) => {
    Object.assign(systemTheme, { matches: isDark });
    systemTheme.dispatchEvent(new Event('change'));
  };
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-appearance');
  document.documentElement.classList.remove('dark');
  vi.unstubAllGlobals();
});

describe('app theme', () => {
  it.each([false, true])(
    'follows the system theme on mount when dark is %s',
    (isDark) => {
      setSystemTheme(isDark);
      const { result } = renderHook(useAppTheme);

      expect(result.current.isDark).toBe(isDark);
      expect(document.documentElement.classList.contains('dark')).toBe(isDark);
      expect(window.matchMedia).toHaveBeenCalledWith(
        '(prefers-color-scheme: dark)'
      );
    }
  );

  it.each([
    ['data-theme', 'dark'],
    ['data-theme', 'light'],
    ['data-appearance', 'dark'],
    ['data-appearance', 'light'],
  ])('honors an explicit %s=%s over the system theme', (attribute, theme) => {
    setSystemTheme(theme !== 'dark');
    document.documentElement.setAttribute(attribute, theme);
    const { result } = renderHook(useAppTheme);
    expect(result.current.isDark).toBe(theme === 'dark');
    expect(document.documentElement.classList.contains('dark')).toBe(
      theme === 'dark'
    );
  });

  it('honors a dark class supplied before mounting', () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(useAppTheme);
    expect(result.current.isDark).toBe(true);
  });

  it('tracks live system theme changes in both directions', () => {
    const { result } = renderHook(useAppTheme);
    act(() => setSystemTheme(true));
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement).toHaveClass('dark');
    act(() => setSystemTheme(false));
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it.each([false, true])(
    'tracks host appearance and returns to the current system theme (dark=%s) when removed',
    async (isDark) => {
      const { result } = renderHook(useAppTheme);
      await act(async () =>
        document.documentElement.setAttribute('data-appearance', 'light')
      );
      act(() => setSystemTheme(true));
      expect(result.current.isDark).toBe(false);
      await act(async () =>
        document.documentElement.setAttribute('data-appearance', 'dark')
      );
      expect(result.current.isDark).toBe(true);
      act(() => setSystemTheme(isDark));
      expect(result.current.isDark).toBe(true);
      await act(async () =>
        document.documentElement.removeAttribute('data-appearance')
      );
      expect(result.current.isDark).toBe(isDark);
      expect(document.documentElement.classList.contains('dark')).toBe(isDark);
    }
  );

  it('falls back to the system for an unrecognized explicit theme', () => {
    setSystemTheme(true);
    document.documentElement.setAttribute('data-theme', 'system');
    const { result } = renderHook(useAppTheme);
    expect(result.current.isDark).toBe(true);
    act(() => setSystemTheme(false));
    expect(result.current.isDark).toBe(false);
  });

  it('returns to the host theme when a manual override is removed', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-appearance', 'dark');
    const { result } = renderHook(useAppTheme);
    expect(result.current.isDark).toBe(false);
    await act(async () =>
      document.documentElement.removeAttribute('data-theme')
    );
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement).toHaveClass('dark');
  });

  it.each([false, true])(
    'keeps a manual choice when the system changes (initial dark=%s)',
    async (isDark) => {
      setSystemTheme(isDark);
      const { result } = renderHook(useAppTheme);
      await act(async () => result.current.toggleTheme());
      act(() => setSystemTheme(!isDark));
      act(() => setSystemTheme(isDark));
      expect(result.current.isDark).toBe(!isDark);
      expect(document.documentElement).toHaveAttribute(
        'data-theme',
        isDark ? 'light' : 'dark'
      );
      expect(document.documentElement.classList.contains('dark')).toBe(!isDark);
    }
  );

  it('removes system and host listeners on unmount', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const { unmount } = renderHook(useAppTheme);
    const listener = vi.mocked(systemTheme.addEventListener).mock.calls[0][1];
    unmount();
    expect(systemTheme.removeEventListener).toHaveBeenCalledWith(
      'change',
      listener
    );
    expect(disconnect).toHaveBeenCalledOnce();
    await act(async () => {
      setSystemTheme(true);
      document.documentElement.setAttribute('data-appearance', 'dark');
    });
    expect(document.documentElement).not.toHaveClass('dark');
    disconnect.mockRestore();
  });

  it('keeps a manual light choice when the host is dark', async () => {
    document.documentElement.setAttribute('data-appearance', 'dark');
    const { result } = renderHook(useAppTheme);
    await act(async () => result.current.toggleTheme());
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(document.documentElement).not.toHaveClass('dark');
    await act(async () =>
      document.documentElement.setAttribute('data-appearance', 'dark')
    );
    expect(result.current.isDark).toBe(false);
    await act(async () => result.current.toggleTheme());
    expect(result.current.isDark).toBe(true);
  });
});
