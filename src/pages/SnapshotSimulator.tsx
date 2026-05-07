import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  Cut,
  CutBoundary,
  DistributedEvent,
  DistributedTrace,
  GlobalState,
  ProcessId,
  SnapshotRun,
  VectorClock,
} from "../types/snapshot.types";
import {
  createVector,
  createCourseTrace,
  eventAtBoundary,
  evaluateCut,
  formatVector,
  maxVector,
} from "../algorithms/snapshots/cut";
import { buildGlobalStateFromCut } from "../algorithms/snapshots/globalState";
import { COLORS, runChandyLamport } from  "../algorithms/snapshots/chandyLamport";

const MODE_LABELS: Record<Mode, string> = {
  cut: "Coupure",
  global: "Etat global",
  chandy: "Chandy-Lamport",
};

const KIND_LABELS: Record<string, string> = {
  internal: "interne",
  send: "emission",
  receive: "reception",
};

const KIND_COLORS: Record<string, string> = {
  internal: "#64748b",
  send: "#2563eb",
  receive: "#059669",
};

const COHERENT_CUT_BOUNDARY: CutBoundary = { P1: 3, P2: 5, P3: 2 };
const DEFAULT_BOUNDARY: CutBoundary = COHERENT_CUT_BOUNDARY;
const SHARED_CUT_BOUNDARY_KEY = "snapshot.sharedCutBoundary";
const CUT_CONSISTENCY_STEP_COUNT = 3;

export type Mode = "cut" | "global" | "chandy";

type SnapshotPanelTab =
  | "frontiers"
  | "analysis"
  | "cut-main"
  | "cut-steps"
  | "global-state"
  | "events"
  | "rules"
  | "chandy-step"
  | "chandy-states"
  | "chandy-channels";

const PANEL_TABS: Record<Mode, Array<{ id: SnapshotPanelTab; label: string }>> = {
  cut: [
    { id: "cut-main", label: "Coupure" },
    { id: "cut-steps", label: "Etapes" },
  ],
  global: [
    { id: "global-state", label: "Etat" },
    { id: "events", label: "Evenements" },
    { id: "rules", label: "Regles" },
  ],
  chandy: [
    { id: "chandy-step", label: "Etape" },
    { id: "chandy-states", label: "Etats" },
    { id: "chandy-channels", label: "Canaux" },
  ],
};

const DEFAULT_PANEL_TAB: Record<Mode, SnapshotPanelTab> = {
  cut: "cut-main",
  global: "global-state",
  chandy: "chandy-step",
};

function readSharedCutBoundary(): CutBoundary {
  if (typeof window === "undefined") return DEFAULT_BOUNDARY;

  try {
    const rawBoundary = window.localStorage.getItem(SHARED_CUT_BOUNDARY_KEY);
    if (!rawBoundary) return DEFAULT_BOUNDARY;
    const parsed = JSON.parse(rawBoundary) as Partial<CutBoundary>;
    return Object.fromEntries(
      Object.entries(DEFAULT_BOUNDARY).map(([processId, defaultValue]) => {
        const value = parsed[processId];
        return [processId, typeof value === "number" ? value : defaultValue];
      })
    ) as CutBoundary;
  } catch {
    return DEFAULT_BOUNDARY;
  }
}

function writeSharedCutBoundary(boundary: CutBoundary) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SHARED_CUT_BOUNDARY_KEY, JSON.stringify(boundary));
  } catch {
    // Storage can be unavailable in private/locked contexts; the local state still works.
  }
}

export default function SnapshotSimulator({ mode }: { mode: Mode }) {
  const trace = useMemo(() => createCourseTrace(), []);
  const [cutBoundary, setCutBoundary] = useState<CutBoundary>(() => readSharedCutBoundary());
  const [cutCheckStepIndex, setCutCheckStepIndex] = useState(0);
  const [cutCheckPlaying, setCutCheckPlaying] = useState(false);
  const [chandyStepIndex, setChandyStepIndex] = useState(0);
  const [chandyPlaying, setChandyPlaying] = useState(false);
  const [globalEventStepIndex, setGlobalEventStepIndex] = useState(0);
  const [globalEventsPlaying, setGlobalEventsPlaying] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState<SnapshotPanelTab>(DEFAULT_PANEL_TAB[mode]);

  const chandyInitiator: ProcessId = "P1";
  const chandyStartBoundary = 2;

  const cut = useMemo(() => evaluateCut(trace, cutBoundary, "manual-cut"), [trace, cutBoundary]);
  const globalState = useMemo(
    () => buildGlobalStateFromCut(trace, cutBoundary, { snapshotId: "etat-global-manuel" }),
    [trace, cutBoundary]
  );
  const snapshotRun = useMemo(
    () => runChandyLamport(trace, chandyInitiator, chandyStartBoundary, "snapshot-chandy-lamport"),
    [trace]
  );
  const activeChandyStep = snapshotRun.steps[Math.min(chandyStepIndex, snapshotRun.steps.length - 1)];
  const activeGlobalEventIndex = Math.min(globalEventStepIndex, Math.max(0, trace.events.length - 1));
  const activeGlobalEvent = trace.events[activeGlobalEventIndex];
  const chandyCut = useMemo(
    () => evaluateCut(trace, activeChandyStep?.recordedBoundary ?? snapshotRun.recordBoundary, "chandy-step"),
    [trace, activeChandyStep, snapshotRun.recordBoundary]
  );
  const displayedCut = mode === "chandy" ? chandyCut : cut;

  useEffect(() => {
    if (!cutCheckPlaying || mode !== "cut") return;
    const timer = window.setInterval(() => {
      setCutCheckStepIndex((index) => {
        if (index >= CUT_CONSISTENCY_STEP_COUNT - 1) {
          setCutCheckPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, [cutCheckPlaying, mode]);

  useEffect(() => {
    if (!chandyPlaying) return;
    const timer = window.setInterval(() => {
      setChandyStepIndex((index) => {
        if (index >= snapshotRun.steps.length - 1) {
          setChandyPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, [chandyPlaying, snapshotRun.steps.length]);

  useEffect(() => {
    if (!globalEventsPlaying || mode !== "global") return;
    const timer = window.setInterval(() => {
      setGlobalEventStepIndex((index) => {
        if (index >= trace.events.length - 1) {
          setGlobalEventsPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, [globalEventsPlaying, mode, trace.events.length]);

  function updateBoundary(processId: ProcessId, value: number) {
    setCutCheckPlaying(false);
    setCutCheckStepIndex(0);
    setCutBoundary((current) => {
      const next = { ...current, [processId]: value };
      writeSharedCutBoundary(next);
      return next;
    });
  }

  function playCutCheck() {
    if (cutCheckStepIndex >= CUT_CONSISTENCY_STEP_COUNT - 1) {
      setCutCheckStepIndex(0);
      setCutCheckPlaying(true);
      return;
    }
    setCutCheckPlaying((playing) => !playing);
  }

  function previousCutCheckStep() {
    setCutCheckPlaying(false);
    setCutCheckStepIndex((index) => Math.max(0, index - 1));
  }

  function nextCutCheckStep() {
    setCutCheckPlaying(false);
    setCutCheckStepIndex((index) => Math.min(CUT_CONSISTENCY_STEP_COUNT - 1, index + 1));
  }

  function resetCutCheck() {
    setCutCheckPlaying(false);
    setCutCheckStepIndex(0);
  }

  function playChandy() {
    if (chandyStepIndex >= snapshotRun.steps.length - 1) {
      setChandyStepIndex(0);
      setChandyPlaying(true);
      return;
    }
    setChandyPlaying((playing) => !playing);
  }

  function previousChandyStep() {
    setChandyPlaying(false);
    setChandyStepIndex((index) => Math.max(0, index - 1));
  }

  function nextChandyStep() {
    setChandyPlaying(false);
    setChandyStepIndex((index) => Math.min(snapshotRun.steps.length - 1, index + 1));
  }

  function resetChandy() {
    setChandyPlaying(false);
    setChandyStepIndex(0);
  }

  function playGlobalEvents() {
    if (globalEventStepIndex >= trace.events.length - 1) {
      setGlobalEventStepIndex(0);
      setGlobalEventsPlaying(true);
      return;
    }
    setGlobalEventsPlaying((playing) => !playing);
  }

  function previousGlobalEvent() {
    setGlobalEventsPlaying(false);
    setGlobalEventStepIndex((index) => Math.max(0, index - 1));
  }

  function nextGlobalEvent() {
    setGlobalEventsPlaying(false);
    setGlobalEventStepIndex((index) => Math.min(trace.events.length - 1, index + 1));
  }

  function resetGlobalEvents() {
    setGlobalEventsPlaying(false);
    setGlobalEventStepIndex(0);
  }

  const visiblePanelTab = PANEL_TABS[mode].some((tab) => tab.id === activePanelTab)
    ? activePanelTab
    : DEFAULT_PANEL_TAB[mode];

  return (
    <div style={styles.shell}>
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>{MODE_LABELS[mode]}</h1>
            <p style={styles.subtitle}>
              événements eij · messages mij · horloges vectorielles · coupures cohérentes
            </p>
          </div>

          <div style={styles.headerBadges}>
            <StatusPill
              ok={displayedCut.isConsistent}
              text={displayedCut.isConsistent ? "cohérent" : "incohérent"}
            />

            <span style={styles.softBadge}>V(C)</span>
            <span style={styles.softBadge}>
              {formatVector(trace.processes, displayedCut.vectorDate)}
            </span>
          </div>
        </header>

        <section style={styles.workspace}>
          <div style={styles.diagramPanel}>
            <TraceDiagram
              trace={trace}
              cut={displayedCut}
              mode={mode}
              snapshotRun={mode === "chandy" ? snapshotRun : undefined}
              chandyStepIndex={mode === "chandy" ? chandyStepIndex : undefined}
              activeEventId={mode === "global" ? activeGlobalEvent?.id : undefined}
            />
          </div>

          <aside style={styles.rightPanel}>
            {(mode === "cut" || mode === "global") && (
              <RightPanelTabs
                tabs={PANEL_TABS[mode]}
                activeTab={visiblePanelTab}
                onTabChange={setActivePanelTab}
              />
            )}

            <div style={styles.rightPanelBody}>
              {mode === "cut" && (
                <>
                  {visiblePanelTab === "cut-main" && (
                    <>
                      <Panel title="Frontieres C">
                        <BoundaryControls trace={trace} boundary={cutBoundary} onChange={updateBoundary} />
                      </Panel>
                      <CutAnalysis trace={trace} cut={cut} />
                    </>
                  )}
                  {visiblePanelTab === "cut-steps" && (
                    <Panel title="Etapes de validation">
                      <CutConsistencySteps trace={trace} cut={cut} stepIndex={cutCheckStepIndex} />
                    </Panel>
                  )}
                </>
              )}
              {mode === "global" && visiblePanelTab === "global-state" && (
                <GlobalAnalysis trace={trace} globalState={globalState} />
              )}
              {mode === "global" && visiblePanelTab === "events" && (
                <EventTable
                  trace={trace}
                  activeEventId={activeGlobalEvent?.id}
                  currentEventIndex={activeGlobalEventIndex}
                />
              )}
              {mode === "global" && visiblePanelTab === "rules" && <TheoryPanel />}
              {mode === "chandy" && (
                <ChandyAnalysis
                  trace={trace}
                  run={snapshotRun}
                  stepIndex={chandyStepIndex}
                />
              )}
            </div>
          </aside>
        </section>

        <SnapshotFooter
          mode={mode}
          currentStep={mode === "cut" ? cutCheckStepIndex : mode === "global" ? activeGlobalEventIndex : chandyStepIndex}
          totalSteps={mode === "cut" ? CUT_CONSISTENCY_STEP_COUNT : mode === "global" ? trace.events.length : snapshotRun.steps.length}
          playing={mode === "cut" ? cutCheckPlaying : mode === "global" ? globalEventsPlaying : chandyPlaying}
          onPlay={mode === "cut" ? playCutCheck : mode === "global" ? playGlobalEvents : playChandy}
          onPrev={mode === "cut" ? previousCutCheckStep : mode === "global" ? previousGlobalEvent : previousChandyStep}
          onNext={mode === "cut" ? nextCutCheckStep : mode === "global" ? nextGlobalEvent : nextChandyStep}
          onReset={mode === "cut" ? resetCutCheck : mode === "global" ? resetGlobalEvents : resetChandy}
        />
      </main>
    </div>
  );
}

function RightPanelTabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: Array<{ id: SnapshotPanelTab; label: string }>;
  activeTab: SnapshotPanelTab;
  onTabChange: (tab: SnapshotPanelTab) => void;
}) {
  return (
    <div style={styles.rightPanelTabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          style={{
            ...styles.rightPanelTab,
            ...(activeTab === tab.id ? styles.rightPanelTabActive : {}),
          }}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function IconReset() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 8a6 6 0 1 0 1.4-3.9" />
      <path d="M2 2v4h4" />
    </svg>
  );
}

function IconPrev() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 4L5 8l5 4" />
      <rect x="4" y="4" width="1.5" height="8" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconNext() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 4l5 4-5 4" />
      <rect x="10.5" y="4" width="1.5" height="8" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5 3.5l8 4.5-8 4.5z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <rect x="4" y="3" width="3" height="10" rx="1" />
      <rect x="9" y="3" width="3" height="10" rx="1" />
    </svg>
  );
}

function SnapshotFooter({
  mode,
  currentStep,
  totalSteps,
  playing,
  onPlay,
  onPrev,
  onNext,
  onReset,
}: {
  mode: Mode;
  currentStep: number;
  totalSteps: number;
  playing: boolean;
  onPlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
}) {
  const isChandy = mode === "chandy";
  const isGlobal = mode === "global";
  const isCut = mode === "cut";
  const hasTimelineControls = isCut || isChandy || isGlobal;
  const safeTotalSteps = Math.max(1, totalSteps);
  const safeCurrentStep = Math.min(Math.max(0, currentStep), safeTotalSteps - 1);
  const progress = hasTimelineControls ? ((safeCurrentStep + 1) / safeTotalSteps) * 100 : 100;
  const stepLabel = hasTimelineControls
    ? `Etape ${safeCurrentStep + 1} / ${safeTotalSteps}`
    : "Coupure manuelle";
  const previousDisabled = !hasTimelineControls || safeCurrentStep <= 0;
  const nextDisabled = !hasTimelineControls || safeCurrentStep >= safeTotalSteps - 1;

  return (
    <footer style={styles.bottomBar}>
      <div style={styles.footerTopRow}>
        <div style={styles.stepInfo}>{stepLabel}</div>

        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>

        {hasTimelineControls && (
          <div style={styles.controls}>
            <button type="button" style={{ ...styles.footerButton, ...styles.footerPrimaryButton }} onClick={onPlay} title="Play/Pause">
              {playing ? <IconPause /> : <IconPlay />}
            </button>
            <button
              type="button"
              style={{ ...styles.footerButton, ...(previousDisabled ? styles.footerButtonDisabled : {}) }}
              onClick={onPrev}
              disabled={previousDisabled}
              title="Precedent"
            >
              <IconPrev />
            </button>
            <button
              type="button"
              style={{ ...styles.footerButton, ...(nextDisabled ? styles.footerButtonDisabled : {}) }}
              onClick={onNext}
              disabled={nextDisabled}
              title="Suivant"
            >
              <IconNext />
            </button>
            <button type="button" style={styles.footerButton} onClick={onReset} title="Reinitialiser">
              <IconReset />
            </button>
          </div>
        )}
      </div>
    </footer>
  );
}

function vectorBeforeEvent(trace: DistributedTrace, event: DistributedEvent): VectorClock {
  const previousEvent = trace.eventsByProcess[event.processId]?.find(
    (candidate) => candidate.processIndex === event.processIndex - 1
  );
  return previousEvent?.vectorClock ?? createVector(trace.processes);
}

function messageForEvent(trace: DistributedTrace, event: DistributedEvent) {
  if (!event.messageId) return undefined;
  if (event.kind === "send") {
    return trace.messages.find((message) => message.sendEventId === event.id);
  }
  if (event.kind === "receive") {
    return trace.messages.find((message) => message.receiveEventId === event.id);
  }
  return undefined;
}

function explainEventVector(trace: DistributedTrace, event: DistributedEvent): string {
  const before = vectorBeforeEvent(trace, event);
  const beforeText = formatVector(trace.processes, before);
  const afterText = formatVector(trace.processes, event.vectorClock);
  const localComponent = event.processId;

  if (event.kind === "internal") {
    return `${event.processId}: V avant = ${beforeText}. Evenement local: on pose V[${localComponent}] = ${event.processIndex}. Resultat: V(${event.label}) = ${afterText}.`;
  }

  if (event.kind === "send") {
    const message = messageForEvent(trace, event);
    const messageLabel = message?.label ?? event.messageId ?? "message";
    return `${event.processId}: V avant = ${beforeText}. Une emission est un evenement local: V[${localComponent}] = ${event.processIndex}. Le message ${messageLabel} transporte ensuite ${afterText}.`;
  }

  const message = messageForEvent(trace, event);
  const receivedVector = message?.sendVector;
  if (!receivedVector) {
    return `${event.processId}: V avant = ${beforeText}. Reception: on fusionne avec le vecteur du message, puis on pose V[${localComponent}] = ${event.processIndex}. Resultat: ${afterText}.`;
  }

  const merged = maxVector(trace.processes, before, receivedVector);
  return `${event.processId}: V avant = ${beforeText}. Le message ${message.label} apporte ${formatVector(trace.processes, receivedVector)}. Max composante par composante = ${formatVector(trace.processes, merged)}, puis V[${localComponent}] = ${event.processIndex}. Resultat: V(${event.label}) = ${afterText}.`;
}

function BoundaryControls({
  trace,
  boundary,
  onChange,
}: {
  trace: DistributedTrace;
  boundary: CutBoundary;
  onChange: (processId: ProcessId, value: number) => void;
}) {
  return (
    <div style={styles.boundaryStack}>
      {trace.processes.map((processId) => (
        <label key={processId} style={styles.fieldLabel}>
          {processId}
          <select
            value={boundary[processId] ?? 0}
            onChange={(event) => onChange(processId, Number(event.target.value))}
            style={styles.select}
          >
            {boundaryOptions(trace, processId).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

function TraceDiagram({
  trace,
  cut,
  mode,
  snapshotRun,
  chandyStepIndex,
  activeEventId,
}: {
  trace: DistributedTrace;
  cut: Cut;
  mode: Mode;
  snapshotRun?: SnapshotRun;
  chandyStepIndex?: number;
  activeEventId?: string;
}) {
  const width = 760;
  const height = 360;
  const left = 54;
  const right = 704;
  const top = 68;
  const rowGap = 108;
  const maxPosition = 14;

  const rowY = (processId: ProcessId) => top + trace.processes.indexOf(processId) * rowGap;
  const eventPositions: Record<ProcessId, Record<string, number>> = {
    P1: { e11: 1, e12: 3, e13: 7, e14: 11, e15: 13 },
    P2: { e21: 1, e22: 3, e23: 4, e24: 6, e25: 9, e26: 12 },
    P3: { e31: 1, e32: 4, e33: 8, e34: 14 },
  };
  const xForPos = (position: number) => left + (position / maxPosition) * (right - left);
  const xForEvent = (event: { processId: ProcessId; id: string }) =>
    xForPos(eventPositions[event.processId]?.[event.id] ?? 0);
  const xForBoundary = (boundary: number, processId: ProcessId) => {
    const event = eventAtBoundary(trace, processId, boundary);
    return event ? xForEvent(event) : left - 30;
  };
  const xForCutBoundary = (boundary: number, processId: ProcessId) => {
    const event = eventAtBoundary(trace, processId, boundary);
    return event ? Math.min(xForEvent(event) + 12, right + 14) : left - 30;
  };

  const eventById = new Map(trace.events.map((e) => [e.id, e]));
  const cutColor = mode === "chandy" ? "#dc2626" : cut.isConsistent ? "#059669" : "#dc2626";

  // Chandy-Lamport step state
  const chandyStep = snapshotRun?.steps[
    Math.min(chandyStepIndex ?? snapshotRun.steps.length - 1, snapshotRun.steps.length - 1)
  ];
  const visibleMarkers = new Set(
    chandyStep?.visibleMarkerIds ?? snapshotRun?.markerTransmissions.map((m) => m.id) ?? []
  );

  // Compute cursor X for the active Chandy step:
  // find the active marker's receive position, or the initiator record time
  let cursorX: number | null = null;
  if (mode === "chandy" && snapshotRun && chandyStep) {
    const activeMarker = snapshotRun.markerTransmissions.find((m) => m.id === chandyStep.activeMarkerId);
    if (activeMarker) {
      cursorX = xForPos(activeMarker.receivePosition);
    } else if (chandyStepIndex === 0) {
      // Step 0: cursor is at initiator record boundary
      const initBoundary = snapshotRun.startBoundary;
      cursorX = xForBoundary(initBoundary, snapshotRun.initiator);
    }
  }

  // Cut polyline
  const cutPoints = trace.processes
    .map((pid) => `${xForCutBoundary(cut.boundary[pid], pid)},${rowY(pid)}`)
    .join(" ");

  // Recorded processes highlight for Chandy
  const recordedProcesses = new Set(
    mode === "chandy" && chandyStep
      ? trace.processes.filter((pid) => (chandyStep.recordedBoundary[pid] ?? -1) >= 0)
      : []
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMid meet" style={styles.svg}>
      <defs>
        {/* Solid arrowhead — application messages use the sender process color */}
        {trace.messages.map((msg) => {
          const color = COLORS[msg.from] ?? "#334155";
          return (
            <marker key={`arr-${msg.id}`} id={`arr-${msg.id}`} viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          );
        })}
        {/* Chandy-Lamport marker arrowheads: color follows the sender process */}
        {snapshotRun?.markerTransmissions.map((mk) => {
          const color = COLORS[mk.from] ?? "#334155";
          return (
            <marker key={`arr-${mk.id}`} id={`arr-${mk.id}`} viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          );
        })}
      </defs>

      {/* ── Background: subtle dot grid ── */}
      {[...Array(maxPosition + 1)].map((_, i) => (
        <line key={`grid-${i}`} x1={xForPos(i)} y1={top - 30} x2={xForPos(i)} y2={top + rowGap * (trace.processes.length - 1) + 30}
          stroke="#cbd5e1" strokeWidth={0.7} strokeDasharray="2 8" opacity={0.28} />
      ))}

      {/* ── Process lines ── */}
      {trace.processes.map((pid) => {
        const y = rowY(pid);
        const color = COLORS[pid] ?? "#334155";
        const isRecorded = recordedProcesses.has(pid);
        return (
          <g key={pid}>
            {/* Highlight bar behind recorded processes in Chandy mode */}
            {isRecorded && (
              <rect x={left - 10} y={y - 14} width={right - left + 20} height={28} rx={4}
                fill={color} opacity={0.07} />
            )}
            {/* Process label */}
            <text x={left - 14} y={y} textAnchor="end" dominantBaseline="middle" fill={color}
              style={{ fontSize: 13, fontWeight: 600, fontFamily: "DM Sans, ui-sans-serif, sans-serif" }}>
              {pid}
            </text>
            {/* Main timeline */}
            <line x1={left - 6} y1={y} x2={right + 10} y2={y}
              stroke={color} strokeWidth={isRecorded ? 2.2 : 1.5} opacity={isRecorded ? 0.62 : 0.22} />
            <polygon
              points={`${right + 9},${y - 4} ${right + 17},${y} ${right + 9},${y + 4}`}
              fill={color}
              opacity={isRecorded ? 0.52 : 0.35}
            />
            {/* Tick at start */}
            <line x1={left - 6} y1={y - 5} x2={left - 6} y2={y + 5} stroke={color} strokeWidth={1.4} opacity={0.38} />
          </g>
        );
      })}

      {/* ── Application messages (solid arrows, colored by sender process) ── */}
      {trace.messages.map((msg) => {
        const sendEv = eventById.get(msg.sendEventId);
        const recvEv = msg.receiveEventId ? eventById.get(msg.receiveEventId) : undefined;
        if (!sendEv) return null;
        const x1 = xForEvent(sendEv);
        const y1 = rowY(msg.from);
        const x2 = recvEv ? xForEvent(recvEv) : x1 + 40;
        const y2 = rowY(msg.to);
        const color = COLORS[msg.from] ?? "#334155";
        const sw = 2.2;
        // Label: place near the middle of the arrow, offset to avoid overlap
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        // Perpendicular offset so label doesn't sit on the line
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
        const ox = -(dy / len) * 14;
        const oy = (dx / len) * 14;
        return (
          <g key={msg.id}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color} strokeWidth={sw}
              markerEnd={`url(#arr-${msg.id})`}
              opacity={0.88}
            />
            {/* Label badge */}
            <rect x={mx + ox - 15} y={my + oy - 10} width={30} height={18} rx={9}
              fill="#ffffff" stroke={color} strokeWidth={1.5} opacity={0.97} />
            <text x={mx + ox} y={my + oy + 4} textAnchor="middle" fill={color}
              style={{ fontSize: 11, fontWeight: 900, fontFamily: "ui-monospace, monospace" }}>
              {msg.label}
            </text>
          </g>
        );
      })}

      {/* ── Chandy-Lamport markers ── */}
      {mode === "chandy" &&
        snapshotRun?.markerTransmissions
          .filter((mk) => visibleMarkers.has(mk.id))
          .map((mk) => {
            const x1 = xForPos(mk.sendPosition);
            const x2 = xForPos(mk.receivePosition);
            const y1 = rowY(mk.from);
            const y2 = rowY(mk.to);
            const active = chandyStep?.activeMarkerId === mk.id;
            const color = COLORS[mk.from] ?? "#334155";
            const arrowId = `arr-${mk.id}`;
            const sw = active ? 3 : 2;
            const opacity = active ? 1 : 0.72;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            // Perpendicular offset for label (same logic as messages)
            const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
            const ox = -(dy / len) * 16;
            const oy = (dx / len) * 16;
            return (
              <g key={mk.id} opacity={opacity}>
                {/* Dashed line */}
                <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={color} strokeWidth={sw}
                  strokeDasharray={active ? "10 5" : "7 4"}
                  markerEnd={`url(#${arrowId})`}
                />
                {/* Vertical tick at send point */}
                <line x1={x1} y1={y1 - 12} x2={x1} y2={y1 + 12}
                  stroke={color} strokeWidth={active ? 3 : 2} />
                {/* Label badge */}
                <rect x={mx + ox - 22} y={my + oy - 10} width={44} height={18} rx={9}
                  fill={color} opacity={active ? 0.15 : 0.08} />
                <rect x={mx + ox - 22} y={my + oy - 10} width={44} height={18} rx={9}
                  fill="none" stroke={color} strokeWidth={1} opacity={0.8} />
                <text x={mx + ox} y={my + oy + 4} textAnchor="middle" fill={color}
                  style={{ fontSize: 10, fontWeight: 900, fontFamily: "ui-sans-serif, sans-serif" }}>
                  {mk.status === "first" ? "MARKER" : "marker"}
                </text>
              </g>
            );
          })}

      {/* ── Cut polyline + dots ── */}
      <polyline points={cutPoints} fill="none" stroke={cutColor} strokeWidth={2.5} strokeDasharray="10 6" opacity={0.9} />
      {trace.processes.map((pid) => (
        <circle key={`cut-${pid}`}
          cx={xForCutBoundary(cut.boundary[pid], pid)} cy={rowY(pid)} r={5}
          fill={cutColor} stroke="#ffffff" strokeWidth={1.5} />
      ))}

      {/* ── Event circles (on top of everything) ── */}
      {trace.events.map((event) => {
        const x = xForEvent(event);
        const y = rowY(event.processId);
        const included = cut.includedEventIds.has(event.id);
        const isRecorded = mode === "chandy" && recordedProcesses.has(event.processId);
        const isActive = event.id === activeEventId;
        const procColor = COLORS[event.processId] ?? "#475569";
        // Filled circle if included in cut, outline if not
        const fill = included ? procColor : "#ffffff";
        const stroke = procColor;
        const r = event.kind === "internal" ? 5.5 : 7;
        // Label: alternate above/below to avoid overlaps
        const procIdx = trace.processes.indexOf(event.processId);
        const labelAbove = procIdx === 0 || procIdx === 2;
        const labelY = labelAbove ? y - r - 7 : y + r + 15;
        return (
          <g key={event.id}>
            {(included || isRecorded) && (
              <circle cx={x} cy={y} r={r + 8} fill={procColor} opacity={included ? 0.08 : 0.05} />
            )}
            {isActive && (
              <circle cx={x} cy={y} r={r + 12} fill="#fff7ed" stroke="#f97316" strokeWidth={2.2} />
            )}
            <circle cx={x} cy={y} r={r}
              fill={fill} stroke={stroke} strokeWidth={included ? 1.6 : 1.4}
              opacity={included || isRecorded ? 1 : 0.7}
            />
            {isActive && (
              <circle cx={x} cy={y} r={r + 3.5} fill="none" stroke="#f97316" strokeWidth={2} />
            )}
            {/* Bold event label */}
            <text x={x} y={labelY} textAnchor="middle"
              fill={isActive ? "#c2410c" : procColor}
              style={{ fontSize: isActive ? 11 : 10, fontWeight: isActive ? 900 : 600, fontFamily: "DM Mono, ui-monospace, monospace" }}>
              {event.label}
            </text>
          </g>
        );
      })}

      {/* ── Chandy step cursor: vertical grey bar at current analysis position ── */}
      {mode === "chandy" && cursorX !== null && (
        <g>
          <line
            x1={cursorX} y1={top - 24}
            x2={cursorX} y2={top + rowGap * (trace.processes.length - 1) + 24}
            stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 3"
          />
          {/* Small label on top */}
          <rect x={cursorX - 20} y={top - 40} width={40} height={16} rx={4} fill="#94a3b8" opacity={0.18} />
          <text x={cursorX} y={top - 28} textAnchor="middle" fill="#64748b"
            style={{ fontSize: 10, fontWeight: 700, fontFamily: "ui-sans-serif, sans-serif" }}>
            étape {(chandyStepIndex ?? 0) + 1}
          </text>
        </g>
      )}

      {/* ── Process labels (right side, step status in Chandy mode) ── */}
      {mode === "chandy" && chandyStep &&
        trace.processes.map((pid) => {
          const recorded = (chandyStep.recordedBoundary[pid] ?? -1) >= 0;
          const y = rowY(pid);
          return recorded ? (
            <g key={`status-${pid}`}>
              <rect x={right + 16} y={y - 10} width={18} height={18} rx={3}
                fill="#059669" opacity={0.15} />
              <text x={right + 25} y={y + 5} textAnchor="middle" fill="#059669"
                style={{ fontSize: 13, fontWeight: 900 }}>✓</text>
            </g>
          ) : (
            <g key={`status-${pid}`}>
              <rect x={right + 16} y={y - 10} width={18} height={18} rx={3}
                fill="#94a3b8" opacity={0.12} />
              <text x={right + 25} y={y + 5} textAnchor="middle" fill="#94a3b8"
                style={{ fontSize: 13, fontWeight: 700 }}>–</text>
            </g>
          );
        })}
    </svg>
  );
}

function CutAnalysis({ trace, cut }: { trace: DistributedTrace; cut: Cut }) {
  return (
    <Panel title="Validation de coupure">
      <StatusPill ok={cut.isConsistent} text={cut.isConsistent ? "coupure coherente" : "coupure incoherente"} />
      <p style={styles.panelText}>{cut.reason}</p>
      <VectorDateCard trace={trace} cut={cut} />
      <div style={styles.vectorCheckPanel}>
        <div style={styles.vectorCheckTitle}>Test de Mattern</div>
        {cut.vectorChecks.map((check) => (
          <div
            key={check.processId}
            style={{
              ...styles.vectorCheckCard,
              ...(check.ok ? styles.vectorCheckCardOk : styles.vectorCheckCardBad),
            }}
          >
            <span style={styles.vectorCheckProcess}>{check.processId}</span>
            <span style={styles.vectorCheckFrontier}>{check.frontierLabel}</span>
            <span style={styles.vectorCheckEquation}>
              V(C)[{check.processId}] {check.ok ? "=" : "!="} {check.boundary}
            </span>
          </div>
        ))}
      </div>
      {cut.violations.length > 0 && (
        <div style={styles.alertList}>
          {cut.violations.map((violation, index) => (
            <div key={`${violation.type}-${index}`} style={styles.alert}>
              {violation.description}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function VectorDateCard({ trace, cut }: { trace: DistributedTrace; cut: Cut }) {
  return (
    <div style={{ ...styles.vectorDateCard, ...(cut.isConsistent ? styles.vectorDateOk : styles.vectorDateBad) }}>
      <div>
        <div style={styles.vectorDateLabel}>Date de la coupure</div>
        <div style={styles.vectorDateHint}>maximum composante par composante</div>
      </div>
      <div style={styles.vectorDateValue}>{formatVector(trace.processes, cut.vectorDate)}</div>
    </div>
  );
}

function CutConsistencySteps({ trace, cut, stepIndex }: { trace: DistributedTrace; cut: Cut; stepIndex: number }) {
  const frontierEvents = trace.processes.map((processId) => cut.frontierEvents[processId]);
  const frontierLabels = frontierEvents.map((event) => event?.label ?? "debut").join(", ");
  const includedEvents = trace.events
    .filter((event) => cut.includedEventIds.has(event.id))
    .map((event) => event.label)
    .join(", ");
  const frontierVectorLines = trace.processes.map((processId) => {
    const frontier = cut.frontierEvents[processId];
    return `V(${frontier?.label ?? "debut"})=${formatVector(trace.processes, frontier?.vectorClock ?? createVector(trace.processes))}`;
  });
  const maxExpression = formatVectorMaxExpression(trace, frontierEvents);
  const safeStepIndex = Math.min(Math.max(0, stepIndex), CUT_CONSISTENCY_STEP_COUNT - 1);

  return (
    <div style={styles.consistencySteps}>
      <div style={styles.stepDots}>
        {Array.from({ length: CUT_CONSISTENCY_STEP_COUNT }, (_, index) => (
          <span
            key={index}
            style={{
              ...styles.stepDot,
              ...(index === safeStepIndex ? styles.stepDotActive : {}),
              ...(index < safeStepIndex ? styles.stepDotDone : {}),
            }}
          />
        ))}
      </div>

      {safeStepIndex === 0 && (
        <div style={styles.consistencyStep}>
          <div style={styles.currentStepMeta}>Etape 1</div>
          <div style={styles.currentStepTitle}>Etat associe a la coupure C</div>
          <div style={styles.currentStepText}>
            Etat local frontiere: {"{"}{frontierLabels}{"}"}
          </div>
          <div style={styles.currentStepText}>
            Evenements inclus dans C: {"{"}{includedEvents || "aucun"}{"}"}
          </div>
        </div>
      )}

      {safeStepIndex === 1 && (
        <div style={styles.consistencyStep}>
          <div style={styles.currentStepMeta}>Etape 2</div>
          <div style={styles.currentStepTitle}>Date de la coupure C</div>
          <div style={styles.vectorProofList}>
            {frontierVectorLines.map((line) => (
              <div key={line} style={styles.currentStepText}>{line}</div>
            ))}
          </div>
          <div style={styles.currentStepText}>V(C)={maxExpression}={formatVector(trace.processes, cut.vectorDate)}</div>
        </div>
      )}

      {safeStepIndex === 2 && (
        <div style={styles.consistencyStep}>
          <div style={styles.currentStepMeta}>Etape 3</div>
          <div style={styles.currentStepTitle}>Verifier par l'horloge vectorielle</div>
          <div style={styles.cutCheckList}>
            {cut.vectorChecks.map((check) => (
              <VectorConsistencyCheck key={check.processId} trace={trace} cut={cut} processId={check.processId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatVectorMaxExpression(trace: DistributedTrace, frontierEvents: Array<DistributedEvent | undefined>): string {
  const vectors = frontierEvents.map((event) => event?.vectorClock ?? createVector(trace.processes));
  const components = trace.processes.map((processId) => `max(${vectors.map((vector) => vector[processId] ?? 0).join(",")})`);
  return `(${components.join(", ")})`;
}

function VectorConsistencyCheck({ trace, cut, processId }: { trace: DistributedTrace; cut: Cut; processId: ProcessId }) {
  const check = cut.vectorChecks.find((item) => item.processId === processId);
  const frontier = cut.frontierEvents[processId];
  const frontierLabel = frontier?.label ?? "debut";
  const frontierComponent = frontier?.vectorClock[processId] ?? 0;
  const vectorComponent = check?.vectorComponent ?? cut.vectorDate[processId] ?? 0;
  const isViolation = vectorComponent !== frontierComponent;
  const statusText = isViolation ? "probleme" : "ok";
  const statusStyle = isViolation
    ? styles.cutCheckBad
    : styles.cutCheckOk;
  const symbol = isViolation ? "!=" : "=";
  const explanation = isViolation
    ? missingHistoryExplanation(trace, cut, processId, vectorComponent)
    : `V(C)[${processId}] = V(${frontierLabel})[${processId}], la frontiere locale est stable.`;

  return (
    <div style={{ ...styles.cutCheckRow, ...statusStyle }}>
      <span style={styles.cutCheckMessage}>{processId}</span>
      <span>{frontierLabel}</span>
      <span>{vectorComponent} {symbol} {frontierComponent}</span>
      <span style={styles.cutCheckStatus}>{statusText}</span>
      <span style={styles.cutCheckExplanation}>{explanation}</span>
    </div>
  );
}

function missingHistoryExplanation(trace: DistributedTrace, cut: Cut, processId: ProcessId, vectorComponent: number): string {
  const boundary = cut.boundary[processId] ?? 0;
  const missingEvents = (trace.eventsByProcess[processId] ?? [])
    .filter((event) => event.processIndex > boundary && event.processIndex <= vectorComponent)
    .map((event) => event.label);
  const witnesses = trace.processes
    .map((pid) => cut.frontierEvents[pid])
    .filter((event): event is DistributedEvent => event !== undefined && (event.vectorClock[processId] ?? 0) > boundary)
    .map((event) => event.label);
  const missingText = missingEvents.length ? missingEvents.join(", ") : `des evenements de ${processId}`;
  const witnessText = witnesses.length ? `hist(${witnesses.join(", ")})` : "l'histoire causale de C";
  return `${missingText} appartiennent a ${witnessText}, mais ne font pas partie de la coupure: C est incoherente.`;
}

function GlobalAnalysis({ trace, globalState }: { trace: DistributedTrace; globalState: GlobalState }) {
  return (
    <Panel title="Etat global S">
      <StatusPill ok={globalState.isConsistent} text={globalState.isConsistent ? "coherent" : "incoherent"} />
      <p style={styles.panelText}>
        S contient les etats locaux el_i situes sur la coupure et les messages en transit ec_ij.
      </p>
      <VectorDateCard trace={trace} cut={globalState.cut} />
      <div style={styles.table}>
        <div style={styles.tableHeader}>Coupure C utilisee</div>
        {trace.processes.map((processId) => {
          const frontier = globalState.cut.frontierEvents[processId];
          return (
            <div key={processId} style={styles.tableRow}>
              <span>{processId}</span>
              <span>c={globalState.boundary[processId]}</span>
              <span>{frontier?.label ?? "debut"}</span>
            </div>
          );
        })}
      </div>
      <div style={styles.table}>
        <div style={styles.tableHeader}>Etats locaux el_i</div>
        {trace.processes.map((processId) => {
          const state = globalState.processStates[processId];
          return (
            <div key={processId} style={styles.tableRow}>
              <span>{processId}</span>
              <span>{state.eventLabel ?? "debut"}</span>
              <span>{formatVector(trace.processes, state.vectorClock)}</span>
            </div>
          );
        })}
      </div>
      <div style={styles.table}>
        <div style={styles.tableHeader}>Etats des canaux ec_ij</div>
        {Object.entries(globalState.channelStates).map(([channel, messages]) => (
          <div key={channel} style={styles.tableRow}>
            <span>{channelToCourse(channel)}</span>
            <span>{messages.length ? messages.map((message) => message.label).join(", ") : "vide"}</span>
            <span>{messages.length ? "transit" : "-"}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// Convert "P1->P2" to "C12" notation used in course
function channelToCourse(channelId: string): string {
  const m = channelId.match(/P(\d+)->P(\d+)/);
  return m ? `C${m[1]}${m[2]}` : channelId;
}

// Format a process's local state as "eij" or "eij(mk)" like the course
function formatLocalState(trace: DistributedTrace, processId: ProcessId, boundary: number): string {
  if (boundary <= 0) return "—";
  const events = trace.eventsByProcess[processId];
  if (!events || events.length === 0) return "—";
  // boundary = number of events recorded (processIndex-based)
  const event = events.find((e) => e.processIndex === boundary);
  if (!event) {
    // try last event at or before boundary
    const ev = [...events].reverse().find((e) => e.processIndex <= boundary);
    return ev ? ev.label : "—";
  }
  return event.label;
}

function shouldShowLegacyChandyTab(tab: SnapshotPanelTab): boolean {
  void tab;
  return false;
}

function ChandyAnalysis({
  trace,
  run,
  stepIndex,
}: {
  trace: DistributedTrace;
  run: SnapshotRun;
  stepIndex: number;
}) {
  const step = run.steps[Math.min(stepIndex, run.steps.length - 1)];
  const playing = false;
  const onStepChange = (step: number) => step;
  const onPlayingChange = (nextPlaying: boolean) => nextPlaying;

  if (shouldShowLegacyChandyTab("chandy-step")) {
    return (
      <Panel title="Snapshot par marqueurs">
        <div style={chandyStyles.stepMeta}>Etape {step.id + 1} / {run.steps.length}</div>
        <div style={chandyStyles.stepBox}>
          <div style={chandyStyles.stepTitle}>{step.title}</div>
          <div style={chandyStyles.stepDetail}>{step.detail}</div>
        </div>
      </Panel>
    );
  }

  if (shouldShowLegacyChandyTab("chandy-states")) {
    return (
      <Panel title="Etats locaux enregistres">
        <div style={chandyStyles.stateGrid}>
          {trace.processes.map((pid) => {
            const boundary = step.recordedBoundary[pid] ?? 0;
            const recorded = boundary > 0;
            const color = COLORS[pid] ?? "#475569";
            const label = recorded ? formatLocalState(trace, pid, boundary) : null;
            return (
              <div key={pid} style={{
                ...chandyStyles.stateCell,
                borderColor: recorded ? color : "#e2e8f0",
                background: recorded ? `${color}10` : "#f8fafc",
              }}>
                <span style={{ ...chandyStyles.statePid, color }}>{pid}</span>
                <span style={chandyStyles.stateVal}>
                  {recorded
                    ? <span style={{ color, fontWeight: 900 }}>{label}</span>
                    : <span style={{ color: "#94a3b8" }}>en attente</span>
                  }
                </span>
              </div>
            );
          })}
        </div>
      </Panel>
    );
  }

  if (shouldShowLegacyChandyTab("chandy-channels")) {
    return (
      <Panel title="Etats des canaux">
        <div style={chandyStyles.channelGrid}>
          {trace.channels.map((channelId) => {
            const closed = step.closedChannels.includes(channelId);
            const messages = step.channelStates[channelId] ?? [];
            const courseId = channelToCourse(channelId);
            const hasMessages = messages.length > 0;
            return (
              <div key={channelId} style={{
                ...chandyStyles.channelRow,
                opacity: closed ? 1 : 0.45,
              }}>
                <span style={chandyStyles.channelId}>{courseId}</span>
                <span style={chandyStyles.channelColon}>:</span>
                <span style={{
                  ...chandyStyles.channelContent,
                  color: hasMessages ? "#d97706" : "#94a3b8",
                  fontWeight: hasMessages ? 900 : 400,
                }}>
                  {closed
                    ? (hasMessages ? `{${messages.map((m) => m.label).join(", ")}}` : "vide")
                    : "..."
                  }
                </span>
                {closed && (
                  <span style={chandyStyles.channelStatus}>ok</span>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Snapshot par marqueurs">
      {/* ── Step navigator ── */}
      <div style={{ ...chandyStyles.stepBar, display: "none" }}>
        <button type="button" style={chandyStyles.navBtn} onClick={() => onStepChange(0)} title="Début">⏮</button>
        <button type="button" style={chandyStyles.navBtn} onClick={() => onStepChange(Math.max(0, stepIndex - 1))} title="Précédent">◀</button>
        <div style={chandyStyles.stepBadge}>
          {step.id + 1} <span style={{ color: "#94a3b8" }}>/ {run.steps.length}</span>
        </div>
        <button type="button"
          style={{ ...chandyStyles.navBtn, ...(playing ? chandyStyles.navBtnActive : {}) }}
          onClick={() => onPlayingChange(!playing)}>
          {playing ? "⏸" : "▶"}
        </button>
        <button type="button" style={chandyStyles.navBtn}
          onClick={() => onStepChange(Math.min(run.steps.length - 1, stepIndex + 1))} title="Suivant">▶</button>
      </div>

      {/* ── Current step description ── */}
      <div style={chandyStyles.stepBox}>
        <div style={chandyStyles.stepMeta}>Etape {step.id + 1} / {run.steps.length}</div>
        <div style={chandyStyles.stepTitle}>{step.title}</div>
        <div style={chandyStyles.stepDetail}>{step.detail}</div>
      </div>

      {/* ── Local states (course notation) ── */}
      <div style={chandyStyles.sectionLabel}>États locaux enregistrés</div>
      <div style={chandyStyles.stateGrid}>
        {trace.processes.map((pid) => {
          const boundary = step.recordedBoundary[pid] ?? 0;
          const recorded = boundary > 0;
          const color = COLORS[pid] ?? "#475569";
          const label = recorded ? formatLocalState(trace, pid, boundary) : null;
          return (
            <div key={pid} style={{
              ...chandyStyles.stateCell,
              borderColor: recorded ? color : "#e2e8f0",
              background: recorded ? `${color}10` : "#f8fafc",
            }}>
              <span style={{ ...chandyStyles.statePid, color }}>{pid}</span>
              <span style={chandyStyles.stateVal}>
                {recorded
                  ? <span style={{ color, fontWeight: 900 }}>{label}</span>
                  : <span style={{ color: "#94a3b8" }}>en attente</span>
                }
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Channel states (course Cij notation) ── */}
      <div style={chandyStyles.sectionLabel}>États des canaux</div>
      <div style={chandyStyles.channelGrid}>
        {trace.channels.map((channelId) => {
          const closed = step.closedChannels.includes(channelId);
          const messages = step.channelStates[channelId] ?? [];
          const courseId = channelToCourse(channelId);
          const hasMessages = messages.length > 0;
          return (
            <div key={channelId} style={{
              ...chandyStyles.channelRow,
              opacity: closed ? 1 : 0.45,
            }}>
              <span style={chandyStyles.channelId}>{courseId}</span>
              <span style={chandyStyles.channelColon}>:</span>
              <span style={{
                ...chandyStyles.channelContent,
                color: hasMessages ? "#d97706" : "#94a3b8",
                fontWeight: hasMessages ? 900 : 400,
              }}>
                {closed
                  ? (hasMessages ? `{${messages.map((m) => m.label).join(", ")}}` : "Ø")
                  : "…"
                }
              </span>
              {closed && (
                <span style={chandyStyles.channelStatus}>✓</span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Final summary on last step ── */}
      
    </Panel>
  );
}

const chandyStyles: Record<string, CSSProperties> = {
  stepMeta: {
    fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const,
    letterSpacing: 0.7, color: "#94a3b8", marginBottom: 8,
  },
  stepBar: {
    display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
  },
  navBtn: {
    border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155",
    borderRadius: 6, padding: "5px 9px", cursor: "pointer", fontSize: 14, fontWeight: 700,
  },
  navBtnActive: {
    background: "#fef3c7", borderColor: "#fbbf24", color: "#92400e",
  },
  stepBadge: {
    flex: 1, textAlign: "center" as const, fontWeight: 900, fontSize: 15, color: "#0f172a",
  },
  stepBox: {
    background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8,
    padding: "10px 12px", marginBottom: 12,
  },
  stepTitle: {
    color: "#c2410c", fontWeight: 900, fontSize: 13, marginBottom: 4,
  },
  stepDetail: {
    color: "#7c2d12", fontSize: 12, lineHeight: 1.5,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const,
    letterSpacing: 0.7, color: "#64748b", marginBottom: 6, marginTop: 4,
  },
  stateGrid: {
    display: "grid", gap: 6, marginBottom: 12,
  },
  stateCell: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    border: "1.5px solid", borderRadius: 8, padding: "7px 10px",
  },
  statePid: {
    fontFamily: "ui-monospace, monospace", fontWeight: 900, fontSize: 13,
  },
  stateVal: {
    fontFamily: "ui-monospace, monospace", fontSize: 12,
  },
  channelGrid: {
    display: "grid", gap: 4, marginBottom: 12,
    gridTemplateColumns: "1fr 1fr",
  },
  channelRow: {
    display: "flex", alignItems: "center", gap: 4,
    background: "#f8fafc", border: "1px solid #e2e8f0",
    borderRadius: 6, padding: "5px 8px",
    transition: "opacity 0.2s",
  },
  channelId: {
    fontFamily: "ui-monospace, monospace", fontWeight: 900, fontSize: 12, color: "#334155",
    minWidth: 28,
  },
  channelColon: {
    color: "#94a3b8", fontSize: 12,
  },
  channelContent: {
    flex: 1, fontFamily: "ui-monospace, monospace", fontSize: 12,
  },
  channelStatus: {
    color: "#059669", fontSize: 11, fontWeight: 900,
  },
  summaryBox: {
    background: "#f0fdf4", border: "1px solid #a7f3d0", borderRadius: 8,
    padding: "10px 12px", marginTop: 4,
  },
  summaryTitle: {
    fontWeight: 900, fontSize: 13, color: "#047857", marginBottom: 8,
  },
  summaryRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "4px 0", fontSize: 13, color: "#374151",
    borderBottom: "1px solid #d1fae5",
  },
};

function TheoryPanel() {
  return (
    <Panel title="Regles du cours" compact>
      <p style={styles.panelText}>
        Une coupure C est coherente si elle est fermee par causalite: reception(m) dans C implique emission(m) dans C.
      </p>
      <p style={styles.panelText}>
        Avec les horloges de Mattern, V(C) est le maximum composante par composante des evenements frontiere.
      </p>
      <p style={styles.panelText}>
        Chandy-Lamport capture une telle coupure sans arreter l'application grace aux marqueurs sur canaux FIFO.
      </p>
    </Panel>
  );
}

function EventTable({
  trace,
  activeEventId,
  currentEventIndex,
}: {
  trace: DistributedTrace;
  activeEventId?: string;
  currentEventIndex: number;
}) {
  const activeEventRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeEventRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [currentEventIndex]);

  return (
    <Panel title="Evenements et horloges" compact>
      <div style={styles.eventTable}>
        {trace.events.map((event, index) => {
          const isActive = event.id === activeEventId;
          const isReached = index <= currentEventIndex;
          return (
            <div
              key={event.id}
              ref={isActive ? activeEventRef : null}
              style={{
                ...styles.eventCell,
                ...(isReached ? styles.eventCellReached : styles.eventCellPending),
                ...(isActive ? styles.eventCellActive : {}),
              }}
            >
              <div style={styles.eventCellHeader}>
                <span style={{ ...styles.eventKind, color: KIND_COLORS[event.kind] }}>{KIND_LABELS[event.kind]}</span>
                <span style={styles.eventCellTitle}>
                  {event.label} - {event.processId}
                </span>
                <span style={styles.eventCellMeta}>{formatVector(trace.processes, event.vectorClock)}</span>
              </div>
              {isActive && (
                <div style={styles.eventCellDetails}>
                  <div style={styles.eventCellDescription}>{event.description}</div>
                  <div style={styles.eventCellFormula}>{explainEventVector(trace, event)}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Panel({ title, compact, children }: { title: string; compact?: boolean; children: ReactNode }) {
  return (
    <section style={{ ...styles.panel, ...(compact ? styles.panelCompact : {}) }}>
      <h2 style={styles.panelTitle}>{title}</h2>
      {children}
    </section>
  );
}

function StatusPill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span style={{ ...styles.statusPill, ...(ok ? styles.statusOk : styles.statusBad) }}>
      {text}
    </span>
  );
}

function boundaryOptions(trace: DistributedTrace, processId: ProcessId): Array<{ value: number; label: string }> {
  return [
    { value: 0, label: "0 - debut" },
    ...trace.eventsByProcess[processId].map((event) => ({
      value: event.processIndex,
      label: `${event.processIndex} - ${event.label}`,
    })),
  ];
}

const styles: Record<string, CSSProperties> = {
  shell: {
    height: "100%",
    minHeight: 0,
    display: "flex",
    overflow: "hidden",
    background: "#f0f2f7",
    color: "#0f172a",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    fontSize: 14,
  },
  sidebar: {
    width: 280,
    flexShrink: 0,
    background: "#ffffff",
    borderRight: "1px solid #d9e1ea",
    padding: 16,
    overflowY: "auto",
  },
  sidebarTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: 800,
    color: "#64748b",
    marginBottom: 14,
  },
  modeGroup: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
  },
  modeButton: {
    border: "1px solid #d9e1ea",
    background: "#f8fafc",
    borderRadius: 8,
    padding: "10px 12px",
    textAlign: "left",
    cursor: "pointer",
    color: "#334155",
    fontWeight: 700,
  },
  modeButtonActive: {
    color: "#0f766e",
    borderColor: "#99f6e4",
    background: "#ecfdf5",
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 8,
    color: "#64748b",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: 800,
  },
  presetList: {
    display: "grid",
    gap: 8,
  },
  presetButton: {
    border: "1px solid #d9e1ea",
    background: "#ffffff",
    borderRadius: 8,
    padding: 10,
    cursor: "pointer",
    display: "grid",
    gap: 4,
    textAlign: "left",
  },
  presetButtonActive: {
    borderColor: "#f59e0b",
    background: "#fffbeb",
  },
  presetLabel: {
    fontWeight: 800,
    color: "#0f172a",
  },
  presetDescription: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
  },
  boundaryStack: {
    display: "grid",
    gap: 10,
  },
  fieldLabel: {
    display: "grid",
    gap: 5,
    color: "#475569",
    fontWeight: 700,
    fontSize: 12,
  },
  select: {
    width: "100%",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
  },
  main: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    height: 72,
    padding: "14px 24px",
    background: "rgba(255, 255, 255, 0.92)",
    backdropFilter: "blur(14px)",
    borderBottom: "1px solid #e9ebf2",
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexShrink: 0,
  },

  title: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: -0.35,
    color: "#0f172a",
  },

  subtitle: {
    margin: "3px 0 0",
    fontSize: 12,
    color: "#94a3b8",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },

  headerBadges: {
    marginLeft: "auto",
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  softBadge: {
    padding: "5px 10px",
    borderRadius: 8,
    background: "#f6f7fb",
    border: "1px solid #e9ebf2",
    color: "#475569",
    fontSize: 11,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontWeight: 600,
  },
  workspace: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    overflow: "hidden",
  },
  diagramPanel: {
    minWidth: 0,
    flex: 1,
    position: "relative",
    padding: 0,
    overflow: "auto",
    background: "#f8faff",
    backgroundImage:
      "radial-gradient(circle at 20% 20%, rgba(37,99,235,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(124,58,237,0.04) 0%, transparent 50%), linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
    backgroundSize: "auto, auto, 32px 32px, 32px 32px",
  },
  svg: {
    width: "100%",
    height: "100%",
    minHeight: 360,
    position: "relative",
    zIndex: 1,
    background: "transparent",
    border: "none",
    borderRadius: 0,
  },
  bottomBar: {
    background: "#ffffff",
    borderTop: "1px solid rgba(0,0,0,0.07)",
    padding: "10px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
    flexShrink: 0,
  },
  footerTopRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  stepInfo: {
    fontSize: 12,
    fontFamily: "DM Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    color: "#94a3b8",
    minWidth: 134,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    background: "#eceef5",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #2563eb, #7c3aed)",
    borderRadius: 2,
    transition: "width 0.3s ease",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  footerButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.13)",
    background: "#f6f7fb",
    color: "#475569",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  footerPrimaryButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderColor: "transparent",
    background: "#2563eb",
    color: "#ffffff",
  },
  footerButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  rightPanel: {
    width: 390,
    flexShrink: 0,
    background: "#ffffff",
    borderLeft: "1px solid rgba(0,0,0,0.07)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  rightPanelTabs: {
    display: "flex",
    borderBottom: "1px solid rgba(0,0,0,0.07)",
    flexShrink: 0,
  },
  rightPanelTab: {
    flex: 1,
    padding: "10px 4px",
    border: "none",
    borderBottom: "2px solid transparent",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 500,
    fontFamily: "DM Sans, ui-sans-serif, sans-serif",
    transition: "all 0.12s",
  },
  rightPanelTabActive: {
    color: "#0f172a",
    borderBottomColor: "#2563eb",
    fontWeight: 600,
  },
  rightPanelBody: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: 12,
    display: "grid",
    alignContent: "start",
    gap: 12,
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #d9e1ea",
    borderRadius: 8,
    padding: 12,
  },
  panelCompact: {
    padding: 10,
  },
  panelTitle: {
    margin: "0 0 10px",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: -0.1,
  },
  panelText: {
    margin: "8px 0",
    color: "#475569",
    lineHeight: 1.45,
    fontSize: 13,
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 9px",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    width: "fit-content",
  },
  statusOk: {
    color: "#047857",
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
  },
  statusBad: {
    color: "#b91c1c",
    background: "#fef2f2",
    border: "1px solid #fecaca",
  },
  vectorDateCard: {
    marginTop: 10,
    borderRadius: 8,
    padding: "11px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
  },
  vectorDateOk: {
    borderColor: "#bbf7d0",
    background: "#f0fdf4",
  },
  vectorDateBad: {
    borderColor: "#fecaca",
    background: "#fff1f2",
  },
  vectorDateLabel: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  vectorDateHint: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 11,
  },
  vectorDateValue: {
    padding: "6px 10px",
    borderRadius: 8,
    background: "#ffffff",
    border: "1px solid rgba(15, 23, 42, 0.12)",
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 900,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  },
  vectorCheckPanel: {
    display: "grid",
    gap: 7,
    marginTop: 10,
  },
  vectorCheckTitle: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  vectorCheckCard: {
    display: "grid",
    gridTemplateColumns: "42px 1fr auto",
    gap: 8,
    alignItems: "center",
    padding: "8px 9px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
  },
  vectorCheckCardOk: {
    borderColor: "#bbf7d0",
    background: "#f0fdf4",
  },
  vectorCheckCardBad: {
    borderColor: "#fecaca",
    background: "#fff1f2",
  },
  vectorCheckProcess: {
    width: 34,
    height: 24,
    borderRadius: 7,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffffff",
    border: "1px solid rgba(15, 23, 42, 0.1)",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 900,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  vectorCheckFrontier: {
    color: "#475569",
    fontSize: 12,
    fontWeight: 800,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  vectorCheckEquation: {
    padding: "3px 7px",
    borderRadius: 6,
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 900,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  table: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 10,
  },
  tableHeader: {
    padding: "7px 9px",
    background: "#f1f5f9",
    color: "#334155",
    fontWeight: 800,
    fontSize: 12,
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    alignItems: "center",
    padding: "7px 9px",
    borderTop: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 12,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  alertList: {
    display: "grid",
    gap: 8,
    marginTop: 10,
  },
  alert: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    borderRadius: 8,
    padding: 9,
    fontSize: 12,
    lineHeight: 1.4,
  },
  sumBox: {
    marginTop: 10,
    borderTop: "1px solid #e2e8f0",
  },
  logList: {
    display: "grid",
    gap: 7,
    marginTop: 10,
  },
  logLine: {
    padding: "8px 9px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.4,
  },
  stepControls: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: 6,
    marginTop: 10,
  },
  smallButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    borderRadius: 8,
    padding: "7px 8px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  },
  primarySmallButton: {
    background: "#0f766e",
    borderColor: "#0f766e",
    color: "#ffffff",
  },
  currentStepBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #fed7aa",
    background: "#fff7ed",
  },
  currentStepMeta: {
    color: "#c2410c",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: 900,
  },
  currentStepTitle: {
    marginTop: 4,
    color: "#0f172a",
    fontWeight: 900,
    fontSize: 13,
  },
  currentStepText: {
    marginTop: 4,
    color: "#7c2d12",
    fontSize: 12,
    lineHeight: 1.45,
  },
  consistencySteps: {
    display: "grid",
    gap: 8,
    marginTop: 10,
  },
  stepDots: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 6,
    alignItems: "center",
  },
  stepDot: {
    height: 4,
    borderRadius: 999,
    background: "#e2e8f0",
  },
  stepDotActive: {
    background: "#f97316",
  },
  stepDotDone: {
    background: "#86efac",
  },
  consistencyStep: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  cutCheckList: {
    display: "grid",
    gap: 6,
    marginTop: 8,
  },
  cutCheckRow: {
    display: "grid",
    gridTemplateColumns: "42px 46px 72px 58px",
    gap: 6,
    alignItems: "center",
    padding: "7px 8px",
    borderRadius: 7,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#334155",
    fontSize: 11,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  cutCheckOk: {
    borderColor: "#bbf7d0",
    background: "#f0fdf4",
  },
  cutCheckTransit: {
    borderColor: "#fed7aa",
    background: "#fff7ed",
  },
  cutCheckBad: {
    borderColor: "#fecaca",
    background: "#fff1f2",
  },
  cutCheckMessage: {
    fontWeight: 900,
    color: "#0f172a",
  },
  cutCheckStatus: {
    textTransform: "uppercase",
    fontSize: 10,
    fontWeight: 900,
  },
  cutCheckExplanation: {
    gridColumn: "1 / -1",
    color: "#475569",
    lineHeight: 1.35,
    fontFamily: "DM Sans, ui-sans-serif, sans-serif",
    fontSize: 12,
  },
  footer: {
    height: 132,
    flexShrink: 0,
    background: "#ffffff",
    borderTop: "1px solid #d9e1ea",
    padding: 12,
    overflowX: "auto",
  },
  eventTable: {
    display: "grid",
    gap: 7,
  },
  eventCell: {
    border: "1px solid #d9e1ea",
    borderRadius: 8,
    padding: 8,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 7,
    background: "#f8fafc",
  },
  eventCellHeader: {
    display: "grid",
    gridTemplateColumns: "82px 1fr auto",
    gap: 8,
    alignItems: "center",
  },
  eventCellReached: {
    background: "#ffffff",
  },
  eventCellPending: {
    opacity: 0.55,
  },
  eventCellActive: {
    borderColor: "#f97316",
    background: "#fff7ed",
    boxShadow: "0 0 0 1px rgba(249, 115, 22, 0.2)",
  },
  eventCellDetails: {
    display: "grid",
    gap: 5,
    paddingTop: 7,
    borderTop: "1px solid #e2e8f0",
  },
  eventCellDescription: {
    color: "#7c2d12",
    fontSize: 12,
    lineHeight: 1.35,
  },
  eventCellFormula: {
    color: "#334155",
    fontSize: 11,
    lineHeight: 1.45,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  eventKind: {
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  eventCellTitle: {
    fontWeight: 800,
    color: "#0f172a",
    fontSize: 12,
  },
  eventCellMeta: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    color: "#64748b",
    fontSize: 11,
  },
  processLabel: {
    fontSize: 15,
    fontWeight: 900,
  },
  axisText: {
    fontSize: 11,
    fill: "#94a3b8",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  eventLabel: {
    fontSize: 12,
    fontWeight: 900,
  },
  vectorText: {
    fontSize: 10,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  messageText: {
    fontSize: 11,
    fontWeight: 900,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  markerText: {
    fontSize: 10,
    fontWeight: 900,
  },
};
