"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  DEFAULT_CORAL_ENVIRONMENT,
  parseCommittedCreaturePresentation,
  type CommittedCreaturePresentation,
  type EnvironmentSnapshotV3,
  type WorldRuntimePort,
  type WorldRuntimeSession,
  type WorldRuntimeStatus,
} from "../../world";
import styles from "./grimo-experience.module.css";

export interface GrimoArea {
  readonly id: string;
  readonly name: string;
  readonly epithet: string;
  readonly environment: EnvironmentSnapshotV3;
}

export interface GrimoExperienceProps {
  readonly areas?: readonly GrimoArea[];
  readonly initialAreaId?: string;
  readonly runtime?: WorldRuntimePort;
  readonly committedPresentation?: unknown;
}

export const INITIAL_GRIMO_AREAS: readonly GrimoArea[] = Object.freeze([
  Object.freeze({
    id: "area-01-coral-plateau",
    name: "霧光の珊瑚台地",
    epithet: "第一観察域",
    environment: DEFAULT_CORAL_ENVIRONMENT,
  }),
]);

const fallbackLabels: Readonly<Record<string, string>> = Object.freeze({
  "webgl-unavailable": "この端末では軽量な景観を表示しています",
  "renderer-init-failed": "景観の描画を軽量表示へ切り替えました",
  "context-lost": "景観の描画を安全な軽量表示へ切り替えました",
  "shader-failed": "景観の描画を安全な軽量表示へ切り替えました",
  "sustained-low-fps": "操作性を保つため軽量な景観を表示しています",
  "schema-incompatible": "景観データを確認できないため軽量表示に切り替えました",
});

function linearToSrgbByte(channel: number): number {
  const srgb = channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, srgb)) * 255);
}

function environmentStyle(environment: EnvironmentSnapshotV3): CSSProperties {
  const red = linearToSrgbByte(environment.keyLight.colorLinear[0]);
  const green = linearToSrgbByte(environment.keyLight.colorLinear[1]);
  const blue = linearToSrgbByte(environment.keyLight.colorLinear[2]);
  return {
    "--grimo-light-rgb": `${red} ${green} ${blue}`,
    "--grimo-quality": environment.qualityTier === "reduced" ? "0" : "1",
  } as CSSProperties;
}

function safeCommittedPresentation(source: unknown): CommittedCreaturePresentation | undefined {
  if (source === undefined) return undefined;
  try {
    return parseCommittedCreaturePresentation(source);
  } catch {
    return undefined;
  }
}

function EnvironmentGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 17.8c2.2-1.2 3.3-3.1 3.4-5.7 2.3.8 3.8.2 4.7-1.8 1.6 2.5 4 3.7 7.1 3.6" />
      <path d="M4 20c4.8-1.1 10.2-1.1 16 0M14.8 5.2c.9 2 2.5 3.2 4.7 3.5" />
      <circle cx="16.6" cy="4.5" r="1.4" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function WaterEgg({ reacting, touch }: { reacting: boolean; touch: number }) {
  return (
    <div
      className={styles.creatureStage}
      data-committed-reaction={reacting ? "true" : "false"}
      data-touch-reaction={touch % 3}
    >
      <span className={styles.creatureShadow} aria-hidden="true" />
      <svg
        aria-label="水属性の犬系グリモ、卵の姿"
        className={styles.egg}
        role="img"
        viewBox="0 0 280 360"
      >
        <defs>
          <filter id="egg-soft-light" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="13" />
          </filter>
          <clipPath id="egg-clip">
            <path d="M140 18C75 18 36 106 36 201c0 84 43 140 104 140s104-56 104-140C244 106 205 18 140 18Z" />
          </clipPath>
        </defs>
        <ellipse
          className={styles.eggAura}
          cx="140"
          cy="204"
          fill="#67dbe8"
          fillOpacity=".42"
          filter="url(#egg-soft-light)"
          rx="116"
          ry="136"
        />
        <path
          d="M140 18C75 18 36 106 36 201c0 84 43 140 104 140s104-56 104-140C244 106 205 18 140 18Z"
          fill="#17617d"
          fillOpacity=".88"
          stroke="#b8f4ff"
          strokeOpacity=".72"
          strokeWidth="3"
        />
        <g clipPath="url(#egg-clip)">
          <ellipse cx="111" cy="115" fill="#dffbff" fillOpacity=".13" rx="68" ry="116" />
          <ellipse cx="180" cy="229" fill="#062e4a" fillOpacity=".34" rx="88" ry="131" />
          <path
            className={styles.innerCurrent}
            d="M53 238c49-47 83-22 111-67 22-35 55-20 82-57v151H42Z"
            fill="#4ee3eb"
            fillOpacity=".22"
          />
          <path
            className={styles.innerCurrentReverse}
            d="M30 272c39-45 83-27 112-73 28-43 74-20 114-75"
            fill="none"
            stroke="#c2fbff"
            strokeOpacity=".54"
            strokeWidth="10"
          />
          <ellipse cx="106" cy="96" fill="#fff" fillOpacity=".46" rx="21" ry="43" transform="rotate(28 106 96)" />
          <path d="m82 208 24-17 16 20 19-52 21 30 27-13" fill="none" stroke="#e5feff" strokeOpacity=".7" strokeWidth="3" />
          <path d="m129 38 12 28-9 26 17 28-14 31" fill="none" stroke="#d8faff" strokeOpacity=".48" strokeWidth="2" />
        </g>
        <path
          d="M73 250c12 49 35 71 67 71 35 0 60-26 71-74"
          fill="none"
          stroke="#b9f8ff"
          strokeOpacity=".45"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function StatusNotice({ status }: { status: WorldRuntimeStatus }) {
  if (status.phase === "poster" || status.phase === "live" || status.phase === "idle") {
    return null;
  }
  const label = status.phase === "loading"
    ? status.label
    : fallbackLabels[status.reason] ?? "軽量な景観を表示しています";
  return (
    <p className={styles.statusNotice} role="status">
      <span aria-hidden="true" />
      {label}
    </p>
  );
}

function trapSheetFocus(event: ReactKeyboardEvent<HTMLElement>): void {
  if (event.key !== "Tab") return;
  const elements = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  );
  if (elements.length === 0) return;
  const first = elements[0]!;
  const last = elements[elements.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function GrimoExperience({
  areas = INITIAL_GRIMO_AREAS,
  initialAreaId,
  runtime,
  committedPresentation,
}: GrimoExperienceProps) {
  if (areas.length === 0) {
    throw new RangeError("GrimoExperience requires at least one available area");
  }
  const initialArea = areas.find((area) => area.id === initialAreaId) ?? areas[0]!;
  const [areaId, setAreaId] = useState(initialArea.id);
  const [environment, setEnvironment] = useState(initialArea.environment);
  const [runtimeStatus, setRuntimeStatus] = useState<WorldRuntimeStatus>(() => runtime
    ? { phase: "loading", progress: 0, label: "景観を整えています" }
    : { phase: "poster" });
  const [areaSheetOpen, setAreaSheetOpen] = useState(false);
  const [touchReaction, setTouchReaction] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<WorldRuntimeSession | undefined>(undefined);
  const mountAreaIdRef = useRef(initialArea.id);
  const areaButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const parsedPresentation = useMemo(
    () => safeCommittedPresentation(committedPresentation),
    [committedPresentation],
  );

  useEffect(() => {
    if (!runtime || !canvasRef.current) return;
    let cancelled = false;
    void runtime.mount({
      canvas: canvasRef.current,
      areaId: mountAreaIdRef.current,
      onEnvironment: (snapshot) => {
        if (!cancelled) setEnvironment(snapshot);
      },
      onHealth: () => undefined,
      onStatus: (status) => {
        if (!cancelled) setRuntimeStatus(status);
      },
    }).then((session) => {
      if (cancelled) session.dispose();
      else sessionRef.current = session;
    }).catch(() => {
      if (!cancelled) {
        setRuntimeStatus({ phase: "fallback", reason: "renderer-init-failed" });
      }
    });
    return () => {
      cancelled = true;
      sessionRef.current?.stop();
      sessionRef.current?.dispose();
      sessionRef.current = undefined;
    };
  }, [runtime]);

  useEffect(() => {
    if (!areaSheetOpen) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAreaSheetOpen(false);
      areaButtonRef.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [areaSheetOpen]);

  const chooseArea = (area: GrimoArea) => {
    setAreaId(area.id);
    setEnvironment(area.environment);
    setAreaSheetOpen(false);
    areaButtonRef.current?.focus();
    if (sessionRef.current) {
      setRuntimeStatus({ phase: "loading", progress: 0, label: "霧の向こうを整えています" });
      void sessionRef.current.setArea(area.id).catch(() => {
        setRuntimeStatus({ phase: "fallback", reason: "renderer-init-failed" });
      });
    }
  };

  const currentArea = areas.find((area) => area.id === areaId) ?? areas[0]!;
  const reacting = parsedPresentation !== undefined;

  return (
    <section
      aria-label="グリモの観察世界"
      className={styles.experience}
      style={environmentStyle(environment)}
    >
      <canvas aria-hidden="true" className={styles.liveCanvas} ref={canvasRef} />
      <div aria-hidden="true" className={styles.posterWorld}>
        <span className={styles.sunVeil} />
        <span className={styles.farSpireA} />
        <span className={styles.farSpireB} />
        <span className={styles.coralShelfA} />
        <span className={styles.coralShelfB} />
        <span className={styles.fogBank} />
        <span className={styles.motes} />
      </div>

      <header className={styles.observationHeader}>
        <p>{currentArea.epithet}</p>
        <h1>{currentArea.name}</h1>
      </header>

      <StatusNotice status={runtimeStatus} />

      <button
        aria-label="水属性の犬系グリモの卵に触れる"
        className={styles.creatureButton}
        key={parsedPresentation?.presentationId ?? "resting"}
        onClick={() => setTouchReaction((value) => value + 1)}
        type="button"
      >
        <WaterEgg reacting={reacting} touch={touchReaction} />
      </button>

      <p aria-live="polite" className={styles.visuallyHidden}>
        {reacting ? "初めての完了が記録され、卵が静かに応えました" : ""}
      </p>

      <button
        aria-expanded={areaSheetOpen}
        aria-haspopup="dialog"
        aria-label="観察するエリアを選ぶ"
        className={styles.areaTrigger}
        onClick={() => setAreaSheetOpen(true)}
        ref={areaButtonRef}
        type="button"
      >
        <EnvironmentGlyph />
      </button>

      {areaSheetOpen ? (
        <section
          aria-label="観察エリア"
          aria-modal="true"
          className={styles.areaSheet}
          onKeyDown={trapSheetFocus}
          role="dialog"
        >
          <div className={styles.sheetRule} aria-hidden="true" />
          <header>
            <div>
              <p>観察域</p>
              <h2>景観を選ぶ</h2>
            </div>
            <button
              aria-label="エリア選択を閉じる"
              className={styles.sheetClose}
              onClick={() => {
                setAreaSheetOpen(false);
                areaButtonRef.current?.focus();
              }}
              ref={closeButtonRef}
              type="button"
            >
              <CloseGlyph />
            </button>
          </header>
          <div className={styles.areaList}>
            {areas.map((area) => (
              <button
                aria-current={area.id === areaId ? "true" : undefined}
                className={styles.areaOption}
                data-selected={area.id === areaId ? "true" : "false"}
                key={area.id}
                onClick={() => chooseArea(area)}
                type="button"
              >
                <span aria-hidden="true" />
                <strong>{area.name}</strong>
                <small>{area.epithet}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
