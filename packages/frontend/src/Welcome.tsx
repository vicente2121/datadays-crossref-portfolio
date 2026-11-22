//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
  AppWindow,
  Archive,
  Calculator,
  Database,
  Palette,
  Pause,
  Play,
  Plug2,
  PanelTop,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { flushSync } from 'react-dom';

import { FabricAppMark } from './FabricAppMark';
import {
  AREAS,
  describeChange,
  hasStarted,
  useSourceActivity,
  type ActivityChange,
  type AreaFamily,
  type SourceActivity,
} from './Welcome.activity';
import './Welcome.css';

type Stage = 'discover' | 'building';

const CAPABILITIES: Record<AreaFamily, { title: string; pitch: string }> = {
  screens: {
    title: 'Screens for your team',
    pitch: 'Pages, forms, and views shaped around how your team works.',
  },
  reads: {
    title: 'Insights at a glance',
    pitch: 'Live charts, tables, and KPIs that stay current.',
  },
  logic: {
    title: 'Your business rules',
    pitch: 'Calculations and thresholds that match how you decide.',
  },
  data: {
    title: 'Records your app keeps',
    pitch: 'Track requests, approvals, and inventory over time.',
  },
  actions: {
    title: 'Secure actions',
    pitch: 'Approve, update, and reach other services or AI safely.',
  },
  connections: {
    title: 'Your Fabric data',
    pitch: 'Power BI models, warehouses, and lakehouses you trust.',
  },
  styling: {
    title: 'Your look and feel',
    pitch: 'Your colors and brand, in light and dark.',
  },
};

const ASSURANCES = [
  { icon: ShieldCheck, label: 'Microsoft sign-in built in' },
  { icon: UsersRound, label: 'Shared from your Fabric workspace' },
  { icon: AppWindow, label: 'Opens inside or outside Fabric' },
];

const AREA_ICONS = {
  screens: PanelTop,
  reads: Database,
  logic: Calculator,
  data: Archive,
  actions: ShieldCheck,
  connections: Plug2,
  styling: Palette,
};

const RECENT_MS = 10_000;
const DISCOVER_TITLE = 'Build the app of your dreams';
const SUBHEAD =
  'Trusted data, business rules, and secure actions in one place.';

export interface WelcomeCompanionProps {
  activity: SourceActivity | null;
  anchors: Partial<Record<AreaFamily, { x: number; y: number }>>;
  lane: number;
  paused: boolean;
  reducedMotion: boolean;
  visible: boolean;
  onActiveChange: (change: ActivityChange | undefined) => void;
  onInteractionChange: (interacting: boolean) => void;
}

interface WelcomeProps {
  companion?: ComponentType<WelcomeCompanionProps>;
  companionName?: string;
  connecting?: boolean | { error?: string };
  // Tests and alternate transports can inject a feed directly. Passing `null`
  // forces the introduction; omitting it observes the dev feed.
  activity?: SourceActivity | null;
}

function ago(at: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(at)) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

// Injected feeds can carry any receipt time; only trust a plausible local one.
// The tolerance covers the gap until the 1s `now` ticker catches up.
function receiptTime(
  live: SourceActivity | null,
  snapshotAt: number,
  now: number
) {
  const at = live?.receivedAt;
  return typeof at === 'number' &&
    Number.isFinite(at) &&
    at > 0 &&
    at <= now + 2_000
    ? at
    : snapshotAt;
}

function labelOf(family: AreaFamily) {
  return AREAS.find((area) => area.family === family)!.label;
}

export function Welcome({
  companion: Companion,
  companionName,
  connecting,
  activity: activityOverride,
}: WelcomeProps) {
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [interacting, setInteracting] = useState(false);
  const [companionChange, setCompanionChange] = useState<ActivityChange>();
  const observed = useSourceActivity(visible && activityOverride === undefined);
  const activity = activityOverride !== undefined ? activityOverride : observed;
  const target: Stage = hasStarted(activity) ? 'building' : 'discover';
  const [stage, setStage] = useState<Stage>(target);
  const transitioning = useRef(false);
  const [settled, setSettled] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const canvas = useRef<HTMLDivElement>(null);
  const [anchors, setAnchors] = useState<
    Partial<Record<AreaFamily, { x: number; y: number }>>
  >({});
  const [lane, setLane] = useState(0);
  const moving = !reducedMotion && !paused && visible && !interacting;
  const canMorph =
    !reducedMotion &&
    !paused &&
    visible &&
    typeof document.startViewTransition === 'function';
  const connectionError =
    typeof connecting === 'object' ? connecting.error : undefined;

  if (stage !== target && !canMorph) setStage(target);

  // Re-runs when a morph settles, so a target that changed mid-transition
  // is still reconciled.
  useEffect(() => {
    if (stage === target || !canMorph || transitioning.current) return;
    transitioning.current = true;
    const transition = document.startViewTransition(() => {
      flushSync(() => setStage(target));
    });
    // `finished` rejects when a transition is skipped; settle either way.
    const settle = () => {
      transitioning.current = false;
      setSettled((count) => count + 1);
    };
    transition.finished.then(settle, settle);
  }, [stage, target, canMorph, settled]);

  useEffect(() => {
    const onVisibility = () => {
      setVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!preference) return;
    const onPreference = () => setReducedMotion(preference.matches);
    onPreference();
    preference.addEventListener('change', onPreference);
    return () => preference.removeEventListener('change', onPreference);
  }, []);

  useLayoutEffect(() => {
    const board = canvas.current;
    if (!board) return;
    const measure = () => {
      const rect = board.getBoundingClientRect();
      const positions: Partial<Record<AreaFamily, { x: number; y: number }>> =
        {};
      for (const area of AREAS) {
        const tile = board.querySelector<HTMLElement>(
          `[data-family="${area.family}"]`
        );
        if (!tile) continue;
        const bounds = tile.getBoundingClientRect();
        positions[area.family] = {
          x: bounds.left - rect.left + bounds.width / 2 - 22,
          y: bounds.top - rect.top - 38,
        };
      }
      setAnchors(positions);
      setLane(rect.width - 38);
    };
    measure();
    const observer =
      typeof globalThis.ResizeObserver === 'undefined'
        ? null
        : new globalThis.ResizeObserver(measure);
    observer?.observe(board);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    if (stage !== 'building') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [stage]);

  const building = stage === 'building';
  const live = building ? activity : null;
  const recent = live?.changes ?? [];
  // Recency uses the feed's clock, advanced by local time since the snapshot
  // arrived, so a retained snapshot settles during a feed outage.
  const snapshotAt = live ? Date.parse(live.generatedAt) : 0;
  const feedNow =
    snapshotAt + Math.max(0, now - receiptTime(live, snapshotAt, now));
  const latestChange =
    recent[0] && feedNow - Date.parse(recent[0].at) < RECENT_MS
      ? recent[0]
      : undefined;
  const activeChange =
    live && !reducedMotion && !paused
      ? Companion
        ? (companionChange ?? latestChange)
        : latestChange
      : undefined;
  const spotlight = recent[0];
  const earlier = recent.slice(1, 5);
  const pieces =
    live?.structure.reduce((total, area) => total + area.count, 0) ?? 0;
  const started = live?.structure.filter((area) => area.count > 0).length ?? 0;
  const SpotlightIcon = spotlight ? AREA_ICONS[spotlight.family] : undefined;
  const caption = spotlight
    ? describeChange(spotlight)
    : companionName
      ? `${companionName} is keeping an eye on your changes`
      : 'Watching for your next change';
  const positions = Object.values(anchors);
  const rows = [...new Set(positions.map((position) => position.y))].sort(
    (a, b) => a - b
  );
  const threads =
    rows
      .map(
        (y) =>
          `M${Math.min(...positions.filter((position) => position.y === y).map((position) => position.x + 22))},${y + 20} H${lane + 18}`
      )
      .join(' ') +
    (rows.length
      ? ` M${lane + 18},${rows[0] + 20} V${rows[rows.length - 1] + 20}`
      : '');

  return (
    <main
      className="app-welcome"
      data-moving={moving}
      data-static={reducedMotion || paused}
      data-working={!!latestChange}
      data-stage={stage}
      data-companion={!!Companion}
      data-mode={activity ? 'live' : 'illustrative'}
      aria-labelledby="app-welcome-title"
    >
      <div className="app-welcome__content" data-ready="true">
        <header className="app-welcome__hero">
          <div className="app-welcome__brand">
            <FabricAppMark />
            <span>Fabric Apps</span>
          </div>
          <h1
            id="app-welcome-title"
            key={stage}
            className="app-welcome__fit"
            data-fit={DISCOVER_TITLE}
          >
            <span>
              {building ? 'Your app is taking shape' : DISCOVER_TITLE}
            </span>
          </h1>
          <div
            className="app-welcome__lede app-welcome__fit"
            data-fit={SUBHEAD}
          >
            {!building && <p className="app-welcome__subhead">{SUBHEAD}</p>}
          </div>
          {connecting && (
            <div className="app-welcome__connection">
              {connectionError ? (
                <p className="app-welcome__connection-error" role="alert">
                  {connectionError}
                </p>
              ) : (
                <p>We're getting connected to your data.</p>
              )}
            </div>
          )}
        </header>

        <section
          className="app-welcome__blueprint"
          aria-labelledby="app-welcome-blueprint"
        >
          <div className="app-welcome__blueprint-heading">
            <h2 id="app-welcome-blueprint" className="app-welcome__sr-only">
              {building
                ? 'The building blocks of your app'
                : 'What a Fabric App can do'}
            </h2>
            {building && (
              <div className="app-welcome__spotlight">
                <span
                  key={spotlight?.id ?? 'waiting'}
                  className="app-welcome__spotlight-icon"
                  aria-hidden="true"
                >
                  {SpotlightIcon && <SpotlightIcon size={13} strokeWidth={2} />}
                </span>
                <p
                  className="app-welcome__caption"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span key={spotlight?.id ?? 'waiting'}>{caption}</span>
                </p>
                {spotlight && (
                  <span className="app-welcome__spotlight-meta">
                    {`${labelOf(spotlight.family)} · ${ago(spotlight.at, now)}`}
                  </span>
                )}
              </div>
            )}
            <div className="app-welcome__blueprint-tools">
              {building && (
                <span
                  className="app-welcome__meter"
                  role="img"
                  aria-label={`${started} of ${AREAS.length} building blocks started`}
                >
                  {AREAS.map((area) => (
                    <i
                      key={area.family}
                      data-active={latestChange?.family === area.family}
                      data-filled={
                        !!live?.structure.find(
                          (entry) => entry.family === area.family
                        )?.count
                      }
                    />
                  ))}
                </span>
              )}
              {building && (
                <span className="app-welcome__live">
                  <i aria-hidden="true" />
                  {`Live · ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`}
                </span>
              )}
              {!reducedMotion && (building || !!Companion) && (
                <button
                  className="app-welcome__motion-toggle"
                  type="button"
                  onClick={() => setPaused((value) => !value)}
                  aria-label={
                    paused ? 'Let the page move' : 'Keep the page still'
                  }
                  title={paused ? 'Let the page move' : 'Keep the page still'}
                >
                  {paused ? (
                    <Play size={13} aria-hidden="true" />
                  ) : (
                    <Pause size={13} aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="app-welcome__canvas" ref={canvas}>
            <svg className="app-welcome__threads" aria-hidden="true">
              <path d={threads} />
            </svg>
            <ul
              className="app-welcome__areas"
              aria-label={
                building ? 'Your app blueprint' : 'What a Fabric App can do'
              }
            >
              {AREAS.map((area) => {
                const state = live?.structure.find(
                  (entry) => entry.family === area.family
                );
                const changed =
                  !!state?.lastChangedAt &&
                  feedNow - Date.parse(state.lastChangedAt) < RECENT_MS;
                const active =
                  activeChange?.family === area.family ||
                  ((reducedMotion || paused) &&
                    changed &&
                    recent[0]?.family === area.family);
                const capability = CAPABILITIES[area.family];
                const detail = !building
                  ? capability.pitch
                  : area.family === 'connections' && state?.names?.length
                    ? `Configured for ${state.names[0]}${state.names.length > 1 ? ` +${state.names.length - 1}` : ''}`
                    : changed
                      ? state?.count
                        ? 'Just updated'
                        : 'Making room for something new'
                      : state?.count
                        ? 'Taking shape'
                        : 'Room to grow';
                const Icon = AREA_ICONS[area.family];
                return (
                  <li
                    key={area.family}
                    className="app-welcome__area"
                    data-family={area.family}
                    data-filled={!!state?.count}
                    data-active={active}
                    title={detail}
                  >
                    {activeChange?.family === area.family && (
                      <span
                        key={activeChange.id}
                        className="app-welcome__area-pulse"
                        aria-hidden="true"
                      />
                    )}
                    <div className="app-welcome__area-body">
                      <div className="app-welcome__area-text">
                        <div className="app-welcome__area-label">
                          <span className="app-welcome__area-icon">
                            <Icon
                              size={18}
                              strokeWidth={1.6}
                              aria-hidden="true"
                            />
                          </span>
                          {building && !!state?.count && (
                            <span
                              className="app-welcome__area-count"
                              aria-hidden="true"
                            >
                              {state.count}
                            </span>
                          )}
                        </div>
                        <h3>{building ? area.label : capability.title}</h3>
                        <p>{detail}</p>
                      </div>
                      {building && (
                        <span
                          className="app-welcome__area-ghost"
                          data-title={capability.title}
                          data-pitch={capability.pitch}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    {building && (
                      <span className="app-welcome__sr-only">
                        {state?.count ?? 0} building{' '}
                        {state?.count === 1 ? 'piece' : 'pieces'}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {Companion && (
              <Companion
                activity={live}
                anchors={anchors}
                lane={lane}
                paused={paused}
                reducedMotion={reducedMotion}
                visible={visible}
                onActiveChange={setCompanionChange}
                onInteractionChange={setInteracting}
              />
            )}
          </div>

          <div className="app-welcome__below">
            {building && earlier.length > 0 && (
              <div className="app-welcome__activity">
                <ol
                  className="app-welcome__timeline"
                  aria-label="Earlier changes"
                >
                  {earlier.map((change) => (
                    <li
                      key={change.id}
                      data-active={change.id === activeChange?.id}
                      data-family={change.family}
                    >
                      {(() => {
                        const ChangeIcon = AREA_ICONS[change.family];
                        return (
                          <ChangeIcon
                            size={14}
                            strokeWidth={1.7}
                            aria-hidden="true"
                          />
                        );
                      })()}
                      <span>{describeChange(change)}</span>
                      <time dateTime={change.at}>{ago(change.at, now)}</time>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {!building && (
              <div className="app-welcome__blueprint-footnote">
                <ul
                  className="app-welcome__assurances"
                  aria-label="Included with every Fabric App"
                >
                  {ASSURANCES.map(({ icon: AssuranceIcon, label }) => (
                    <li key={label}>
                      <AssuranceIcon size={12} aria-hidden="true" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
