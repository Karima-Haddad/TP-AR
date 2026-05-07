import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  Cut,
  CutBoundary,
  DistributedTrace,
  GlobalState,
  ProcessId,
  SnapshotRun,
} from "../types/snapshot.types";
import {
  createCourseTrace,
  eventAtBoundary,
  evaluateCut,
  formatVector,
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

const DEFAULT_BOUNDARY: CutBoundary = { P1: 3, P2: 2, P3: 3 };

export type Mode = "cut" | "global" | "chandy";

export default function SnapshotSimulator({ mode }: { mode: Mode }) {
  const trace = useMemo(() => createCourseTrace(), []);
  const [cutBoundary, setCutBoundary] = useState<CutBoundary>(DEFAULT_BOUNDARY);
  const [chandyStepIndex, setChandyStepIndex] = useState(0);
  const [chandyPlaying, setChandyPlaying] = useState(false);

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
  const chandyCut = useMemo(
    () => evaluateCut(trace, activeChandyStep?.recordedBoundary ?? snapshotRun.recordBoundary, "chandy-step"),
    [trace, activeChandyStep, snapshotRun.recordBoundary]
  );
  const displayedCut = mode === "chandy" ? chandyCut : cut;

  useEffect(() => {
    setChandyStepIndex(0);
    setChandyPlaying(false);
  }, [snapshotRun]);

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

  function updateBoundary(processId: ProcessId, value: number) {
    setCutBoundary((current) => ({ ...current, [processId]: value }));
  }

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
            />
          </div>

          <aside style={styles.rightPanel}>
            {mode === "cut" && (
              <Panel title="Frontieres C">
                <BoundaryControls trace={trace} boundary={cutBoundary} onChange={updateBoundary} />
              </Panel>
            )}
            {mode === "cut" && <CutAnalysis trace={trace} cut={cut} />}
            {mode === "global" && (
              <>
                <GlobalAnalysis trace={trace} globalState={globalState} />
                <EventTable trace={trace} />
                <TheoryPanel />
              </>
            )}
            {mode === "chandy" && (
              <ChandyAnalysis
                trace={trace}
                run={snapshotRun}
                stepIndex={chandyStepIndex}
                playing={chandyPlaying}
                onStepChange={setChandyStepIndex}
                onPlayingChange={setChandyPlaying}
              />
            )}
          </aside>
        </section>
      </main>
    </div>
  );
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

// Message colors palette — each message gets a distinct color like in course diagrams
const MESSAGE_COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#be185d", "#65a30d"];

function TraceDiagram({
  trace,
  cut,
  mode,
  snapshotRun,
  chandyStepIndex,
}: {
  trace: DistributedTrace;
  cut: Cut;
  mode: Mode;
  snapshotRun?: SnapshotRun;
  chandyStepIndex?: number;
}) {
  const width = 980;
  const height = 340;
  const left = 80;
  const right = 930;
  const top = 60;
  const rowGap = 100;
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

  const eventById = new Map(trace.events.map((e) => [e.id, e]));
  const messagesInChannel = new Set(Object.values(cut.channels).flat().map((m) => m.id));
  const ghostMessages = new Set(cut.ghostMessages.map((m) => m.id));
  const cutColor = cut.isConsistent ? "#059669" : "#dc2626";

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
    .map((pid) => `${xForBoundary(cut.boundary[pid], pid)},${rowY(pid)}`)
    .join(" ");

  // Recorded processes highlight for Chandy
  const recordedProcesses = new Set(
    mode === "chandy" && chandyStep
      ? trace.processes.filter((pid) => (chandyStep.recordedBoundary[pid] ?? -1) >= 0)
      : []
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={styles.svg}>
      <defs>
        {/* Solid arrowhead — per message color injected via stroke trick with marker-mid */}
        {trace.messages.map((msg, i) => {
          const isGhost = ghostMessages.has(msg.id);
          const isInChannel = messagesInChannel.has(msg.id);
          const color = isGhost ? "#dc2626" : isInChannel ? "#f59e0b" : MESSAGE_COLORS[i % MESSAGE_COLORS.length];
          return (
            <marker key={`arr-${msg.id}`} id={`arr-${msg.id}`} viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          );
        })}
        {/* Marker arrowheads */}
        <marker id="arr-mkr-first" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f766e" />
        </marker>
        <marker id="arr-mkr-closing" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c3aed" />
        </marker>
        <marker id="arr-mkr-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#d97706" />
        </marker>
      </defs>

      {/* ── Background: subtle dot grid ── */}
      {[...Array(maxPosition + 1)].map((_, i) => (
        <line key={`grid-${i}`} x1={xForPos(i)} y1={top - 30} x2={xForPos(i)} y2={top + rowGap * (trace.processes.length - 1) + 30}
          stroke="#e2e8f0" strokeWidth={1} strokeDasharray="2 6" />
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
            <text x={left - 14} y={y + 5} textAnchor="end" fill={color}
              style={{ fontSize: 15, fontWeight: 900, fontFamily: "ui-monospace, monospace" }}>
              {pid}
            </text>
            {/* Main timeline */}
            <line x1={left - 6} y1={y} x2={right + 12} y2={y}
              stroke={color} strokeWidth={isRecorded ? 3 : 2.5} opacity={isRecorded ? 0.9 : 0.45} />
            {/* Tick at start */}
            <line x1={left - 6} y1={y - 6} x2={left - 6} y2={y + 6} stroke={color} strokeWidth={2} opacity={0.5} />
          </g>
        );
      })}

      {/* ── Application messages (straight diagonal arrows, colored) ── */}
      {trace.messages.map((msg, i) => {
        const sendEv = eventById.get(msg.sendEventId);
        const recvEv = msg.receiveEventId ? eventById.get(msg.receiveEventId) : undefined;
        if (!sendEv) return null;
        const x1 = xForEvent(sendEv);
        const y1 = rowY(msg.from);
        const x2 = recvEv ? xForEvent(recvEv) : x1 + 40;
        const y2 = rowY(msg.to);
        const isGhost = ghostMessages.has(msg.id);
        const isInChannel = messagesInChannel.has(msg.id);
        const color = isGhost ? "#dc2626" : isInChannel ? "#f59e0b" : MESSAGE_COLORS[i % MESSAGE_COLORS.length];
        const dash = isGhost ? "7 4" : undefined;
        const sw = isGhost ? 2.5 : 2.2;
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
              strokeDasharray={dash}
              markerEnd={`url(#arr-${msg.id})`}
              opacity={isGhost ? 0.95 : 0.88}
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
            const color = active ? "#d97706" : mk.status === "first" ? "#0f766e" : "#7c3aed";
            const arrowId = active ? "arr-mkr-active" : mk.status === "first" ? "arr-mkr-first" : "arr-mkr-closing";
            const sw = active ? 3 : 2;
            const opacity = active ? 1 : 0.65;
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
          cx={xForBoundary(cut.boundary[pid], pid)} cy={rowY(pid)} r={5}
          fill={cutColor} stroke="#ffffff" strokeWidth={1.5} />
      ))}

      {/* ── Event circles (on top of everything) ── */}
      {trace.events.map((event) => {
        const x = xForEvent(event);
        const y = rowY(event.processId);
        const included = cut.includedEventIds.has(event.id);
        const isRecorded = mode === "chandy" && recordedProcesses.has(event.processId);
        const procColor = COLORS[event.processId] ?? "#475569";
        // Filled circle if included in cut, outline if not
        const fill = included ? procColor : "#ffffff";
        const stroke = procColor;
        const r = 9;
        // Label: alternate above/below to avoid overlaps
        const procIdx = trace.processes.indexOf(event.processId);
        const labelAbove = procIdx === 0 || procIdx === 2;
        const labelY = labelAbove ? y - 16 : y + 24;
        return (
          <g key={event.id}>
            <circle cx={x} cy={y} r={r}
              fill={fill} stroke={stroke} strokeWidth={2.5}
              opacity={isRecorded ? 1 : 0.88}
            />
            {/* Bold event label */}
            <text x={x} y={labelY} textAnchor="middle"
              fill={procColor}
              style={{ fontSize: 11, fontWeight: 900, fontFamily: "ui-monospace, monospace" }}>
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
      <InfoLine label="Date V(C)" value={formatVector(trace.processes, cut.vectorDate)} />
      <div style={styles.table}>
        <div style={styles.tableHeader}>Test de Mattern</div>
        {cut.vectorChecks.map((check) => (
          <div key={check.processId} style={styles.tableRow}>
            <span>{check.processId}</span>
            <span>{check.frontierLabel}</span>
            <span>
              {check.vectorComponent} {check.ok ? "=" : "!="} {check.boundary}
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

function GlobalAnalysis({ trace, globalState }: { trace: DistributedTrace; globalState: GlobalState }) {
  return (
    <Panel title="Etat global S">
      <StatusPill ok={globalState.isConsistent} text={globalState.isConsistent ? "coherent" : "incoherent"} />
      <p style={styles.panelText}>
        S contient les etats locaux el_i situes sur la coupure et les messages en transit ec_ij.
      </p>
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
            <span>{channel}</span>
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

function ChandyAnalysis({
  trace,
  run,
  stepIndex,
  playing,
  onStepChange,
  onPlayingChange,
}: {
  trace: DistributedTrace;
  run: SnapshotRun;
  stepIndex: number;
  playing: boolean;
  onStepChange: (step: number) => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const step = run.steps[Math.min(stepIndex, run.steps.length - 1)];

  return (
    <Panel title="Snapshot par marqueurs">
      {/* ── Step navigator ── */}
      <div style={chandyStyles.stepBar}>
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

function EventTable({ trace }: { trace: DistributedTrace }) {
  return (
    <Panel title="Evenements et horloges" compact>
      <div style={styles.eventTable}>
        {trace.events.map((event) => (
          <div key={event.id} style={styles.eventCell}>
            <span style={{ ...styles.eventKind, color: KIND_COLORS[event.kind] }}>{KIND_LABELS[event.kind]}</span>
            <span style={styles.eventCellTitle}>
              {event.label} - {event.processId}
            </span>
            <span style={styles.eventCellMeta}>{formatVector(trace.processes, event.vectorClock)}</span>
          </div>
        ))}
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoLine}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
    background: "#eef2f6",
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
    padding: 14,
    overflow: "hidden",
  },
  svg: {
    width: "100%",
    height: "100%",
    minHeight: 360,
    background: "#ffffff",
    border: "1px solid #d9e1ea",
    borderRadius: 8,
  },
  rightPanel: {
    width: 390,
    flexShrink: 0,
    background: "#f8fafc",
    borderLeft: "1px solid #d9e1ea",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflowY: "auto",
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
    fontSize: 14,
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
  infoLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "6px 0",
    borderBottom: "1px solid #eef2f7",
    color: "#475569",
    fontSize: 13,
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
    gridTemplateColumns: "82px 1fr auto",
    gap: 8,
    alignItems: "center",
    background: "#f8fafc",
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