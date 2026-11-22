import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Welcome } from './Welcome';
import { AREAS, parseActivity, type SourceActivity } from './Welcome.activity';

function activity(): SourceActivity {
  const at = new Date().toISOString();
  return {
    structure: AREAS.map(({ family }) => ({
      family,
      count: family === 'logic' ? 1 : 0,
      lastChangedAt: family === 'logic' ? at : null,
    })),
    changes: [{ id: 'change-example', family: 'logic', kind: 'update', at }],
    generatedAt: at,
  };
}

describe('shared welcome and live activity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(activity()), {
            headers: { 'content-type': 'application/json' },
          })
      )
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('introduces what a Fabric App can do before anything changes', () => {
    render(<Welcome activity={null} />);
    expect(
      screen.getByRole('heading', { name: 'Build the app of your dreams' })
    ).toBeVisible();
    for (const title of [
      'Screens for your team',
      'Insights at a glance',
      'Your business rules',
      'Records your app keeps',
      'Secure actions',
      'Your Fabric data',
      'Your look and feel',
    ])
      expect(screen.getByRole('heading', { name: title })).toBeVisible();
    expect(screen.getByText('Microsoft sign-in built in')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /your app builder/ })
    ).toBeNull();
  });

  it('shows each building block and the latest change once work starts', () => {
    const { container } = render(<Welcome activity={activity()} />);
    expect(
      screen.getByRole('heading', { name: 'Your app is taking shape' })
    ).toBeVisible();
    for (const area of AREAS)
      expect(screen.getByRole('heading', { name: area.label })).toBeVisible();
    expect(screen.getByText('Updated the calculations')).toBeVisible();
    expect(
      screen.getByRole('img', { name: '1 of 7 building blocks started' })
    ).toBeVisible();
    expect(container.querySelector('[data-family="logic"]')).toHaveAttribute(
      'data-active',
      'true'
    );
    expect(container.querySelector('.app-welcome')).toHaveAttribute(
      'data-working',
      'true'
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('polls the dev activity endpoint without an optional feature', async () => {
    render(<Welcome />);
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('heading', { name: 'Your app is taking shape' })
    ).toBeVisible();
    await act(async () => vi.advanceTimersByTimeAsync(2500));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the building view when a later poll fails', async () => {
    render(<Welcome />);
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(
      screen.getByRole('heading', { name: 'Your app is taking shape' })
    ).toBeVisible();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 503 }));
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(
      screen.getByRole('heading', { name: 'Your app is taking shape' })
    ).toBeVisible();
  });

  it('lets the working indicators settle when later polls keep failing', async () => {
    const { container } = render(<Welcome />);
    await act(async () => vi.advanceTimersByTimeAsync(0));
    const main = container.querySelector('.app-welcome');
    expect(main).toHaveAttribute('data-working', 'true');
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    await act(async () => vi.advanceTimersByTimeAsync(12_000));
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(main).toHaveAttribute('data-working', 'false');
    expect(container.querySelector('[data-active="true"]')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Your app is taking shape' })
    ).toBeVisible();
    expect(screen.getByText('Updated the calculations')).toBeVisible();
  });

  it.each([
    ['absent', () => undefined],
    ['valid', () => Date.now()],
    ['future', () => Date.now() + 60_000],
    ['negative', () => -1],
    ['non-finite', () => Number.NaN],
    ['infinite', () => Number.POSITIVE_INFINITY],
  ])('ages a retained snapshot with an injected %s receipt time', (_, at) => {
    const { container } = render(
      <Welcome activity={{ ...activity(), receivedAt: at() }} />
    );
    const main = container.querySelector('.app-welcome');
    expect(main).toHaveAttribute('data-working', 'true');
    act(() => vi.advanceTimersByTime(12_000));
    expect(main).toHaveAttribute('data-working', 'false');
  });

  it('settles a skipped transition without an unhandled rejection', async () => {
    const startViewTransition = vi.fn((update: () => void) => ({
      finished: Promise.resolve()
        .then(update)
        .then(() => Promise.reject(new Error('skipped'))),
    }));
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });
    try {
      const { rerender } = render(<Welcome activity={null} />);
      rerender(<Welcome activity={activity()} />);
      await act(async () => vi.advanceTimersByTimeAsync(0));
      rerender(<Welcome activity={null} />);
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(startViewTransition).toHaveBeenCalledTimes(2);
      expect(
        screen.getByRole('heading', { name: 'Build the app of your dreams' })
      ).toBeVisible();
    } finally {
      delete (document as { startViewTransition?: unknown })
        .startViewTransition;
    }
  });

  it('reconciles a stage change that arrives during a pending transition', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const startViewTransition = vi.fn((update: () => void) => {
      const updated = Promise.resolve().then(update);
      return { finished: updated.then(() => gate) };
    });
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });
    try {
      const { rerender } = render(<Welcome activity={null} />);
      rerender(<Welcome activity={activity()} />);
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(
        screen.getByRole('heading', { name: 'Your app is taking shape' })
      ).toBeVisible();
      rerender(<Welcome activity={null} />);
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(startViewTransition).toHaveBeenCalledTimes(1);
      await act(async () => {
        release();
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(startViewTransition).toHaveBeenCalledTimes(2);
      expect(
        screen.getByRole('heading', { name: 'Build the app of your dreams' })
      ).toBeVisible();
    } finally {
      delete (document as { startViewTransition?: unknown })
        .startViewTransition;
    }
  });
  it('does not include a production polling path', async () => {
    vi.stubEnv('DEV', false);
    render(<Welcome />);
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(fetch).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'Build the app of your dreams' })
    ).toBeVisible();
  });
  it('keeps a failed connection explicit instead of reporting loading', () => {
    render(
      <Welcome activity={null} connecting={{ error: 'Sign-in required.' }} />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in required.');
    expect(
      screen.queryByText("We're getting connected to your data.")
    ).toBeNull();
  });

  it('rejects malformed activity snapshots', () => {
    expect(parseActivity(activity())).not.toBeNull();
    expect(parseActivity({ ...activity(), structure: [] })).toBeNull();
    expect(parseActivity({ ...activity(), generatedAt: 'invalid' })).toBeNull();
  });
});
