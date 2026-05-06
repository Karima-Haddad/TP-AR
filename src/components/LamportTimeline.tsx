import type { LamportStep, LamportEvent } from "../algorithms/mutex/lamport/types";
import "../styles/lamport.css";

type Props = {
  step: LamportStep;
};

const processY: Record<number, number> = {
  1: 90,
  2: 230,
  3: 370,
};

const SVG_WIDTH = 1050;
const AXIS_START = 70;
const AXIS_END = 1280;
const SC_WIDTH: Record<number, number> = {
  1: 142,
  2: 125,
  3: 180,
};

const eventX = (event: LamportEvent) => {
  // priorité : position manuelle
  if (event.x !== undefined) return event.x;

  // anciens cas spéciaux (optionnel)
  if (event.type === "EXIT_CS" && event.from === 1) {
    return 820;
  }

  if (event.type === "REL" && event.from === 1) {
    return 820;
  }

  if (event.type === "EXIT_CS" && event.from === 2) {
    return 1040;
  }

  if (event.type === "REL" && event.from === 2) {
    return 1040;
  }

  // fallback automatique
  return 50 + event.step * 80;
};


const eventDx = (event: LamportEvent) => {
  if (event.dx !== undefined) return event.dx;
  return 70;
};


export default function LamportTimeline({ step }: Props) {
  const currentStepNum = step.state.currentStep;

  return (
    <div className="timeline-scroll">
    <svg
      className="timeline-svg"
      width={SVG_WIDTH}
      height="100%"
      viewBox={`0 0 ${SVG_WIDTH} 620`}
      preserveAspectRatio="xMinYMin meet"
    >
      <defs>
        <marker id="arrow-blue" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#2563EB" />
        </marker>

        <marker id="arrow-green" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#059669" />
        </marker>

        <marker id="arrow-red" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#DC2626" />
        </marker>
      </defs>

      {step.state.processes.map((p) => (
        <g key={p.id}>
          <text x="40" y={processY[p.id] - 18} className="timeline-site">
            Site {p.id}
          </text>

          <line
            x1={AXIS_START}
            y1={processY[p.id]}
            x2={AXIS_END}
            y2={processY[p.id]}
            className="timeline-axis"
          />

          <ClockBox
            x={70}
            y={processY[p.id]}
            label={p.name}
            clock={p.clock}
          />
        </g>
      ))}

      <CriticalSectionLine step={step} currentStepNum={currentStepNum} />

      {step.events.map((event) => {
        if (event.type === "ENTER_CS" || event.type === "EXIT_CS") {
          return <CriticalEvent key={event.id} event={event} />;
        }

        if (!event.from || !event.to) return null;

        return (
          <MessageEvent
            key={event.id}
            event={event}
            isActive={event.step === currentStepNum}
          />
        );
      })}

      {step.state.processes.map((p) => (
        <QueueState
          key={`queue-${p.id}`}
          processId={p.id}
          y={465}
          entries={step.state.queues[p.id] ?? []}
        />
      ))}
    </svg>
  </div>
  );
}

function MessageEvent({
  event,
  isActive,
}: {
  event: LamportEvent;
  isActive: boolean;
}) {
  const x1 = eventX(event);
  const x2 = x1 + eventDx(event);

  const labelDy = event.labelDy ?? -70;
  const clockDy = event.clockDy ?? -16;

  const y1 = processY[event.from!];
  const y2 = processY[event.to!];

  const color =
    event.type === "REQ"
      ? "#2563EB"
      : event.type === "ACQ"
      ? "#059669"
      : "#DC2626";


  const marker =
    event.type === "REQ"
      ? "url(#arrow-blue)"
      : event.type === "ACQ"
      ? "url(#arrow-green)"
      : "url(#arrow-red)";

  const displayType =
    event.type === "ACQ" ? "ACK" : event.type === "REL" ? "LIB" : "REQ";

  return (
    <g className={`timeline-event ${isActive ? "active-event" : "past-event"}`}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        markerEnd={marker}
        strokeDasharray={event.type === "ACQ" ? "8 7" : undefined}
        className={`timeline-message ${event.type === "ACQ" ? "ack-dashed" : ""}`}
      />

      {isActive && (
        <g className="event-type-badge">
          <rect
            x={(x1 + x2) / 2 - 25}
            y={(y1 + y2) / 2 - 58}
            width="50"
            height="22"
            rx="11"
            className={`event-type-bg ${event.type.toLowerCase()}`}
          />

          <text
            x={(x1 + x2) / 2}
            y={(y1 + y2) / 2 - 43}
            textAnchor="middle"
            className="event-type-text"
          >
            {displayType}
          </text>
        </g>
      )}

      {event.label && (
  <g className={`event-label ${isActive ? "show-label" : ""}`}>
    <g className="event-label-group">
  <rect
    x={(x1 + x2) / 2 - 46}
    y={(y1 + y2) / 2 + labelDy - 16}
    width="92"
    height="23"
    rx="8"
    className={`message-label-bg ${event.type.toLowerCase()}`}
  />

  <text
    x={(x1 + x2) / 2}
    y={(y1 + y2) / 2 + labelDy}
    textAnchor="middle"
    className="timeline-label"
  >
    {event.label}
  </text>
</g>
  </g>
)}

{/* 
<EventClock
  x={x1 - 18}
  y={y1 - 16}
  value={event.timestamp}
/>

<EventClock
  x={x2 + 18}
  y={y2 - 16}
  value={event.receiveTimestamp}
/> */}


<EventClock
  x={x1 + 20}
  y={y1 + clockDy + 28}
  value={event.timestamp}
/>

<EventClock
  x={x2 - 18}
  y={y2 + clockDy}
  value={event.receiveTimestamp}
/>

      {/* <EventClock
        x={(x1 + x2) / 2}
        y={(y1 + y2) / 2 + 24}
        value={event.timestamp}
      />
      <EventClock
        x={x2 - 18}
        y={y2 - 10}
        value={event.receiveTimestamp ?? event.timestamp}
      /> */}
    </g>
  );
}

function EventClock({
  x,
  y,
  value,
}: {
  x: number;
  y: number;
  value?: number;
}) {
  return (
    <g className="event-clock-badge">
      <rect x={x - 16} y={y - 10} width="32" height="17" rx="8.5" />
      <text x={x} y={y + 3} textAnchor="middle">
        H={value}
      </text>
    </g>
  );
}

function CriticalEvent({ event }: { event: LamportEvent }) {
  const x = eventX(event);
  const y = processY[event.from ?? 1];

  const isEnter = event.type === "ENTER_CS";
  const isExit = event.type === "EXIT_CS";

  const badgeX = isExit ? event.from === 2 ? x - 100 : x - 80 : event.from === 2 ? x - 300 : x - 190;
  const textX = isExit ? event.from === 2 ? x - 50 : x - 30 : event.from === 2 ? x - 250 : x - 140;

  return (
    <g className="timeline-event critical-event-always">
      <rect
        x={badgeX}
        y={isEnter ? y - 38 : y + 22}
        width="98"
        height="25"
        rx="9"
        className={isEnter ? "cs-enter" : "cs-exit"}
      />

      <text
        x={textX}
        y={isEnter ? y - 21 : y + 39}
        textAnchor="middle"
        className="cs-label"
      >
        {event.label}
      </text>
    </g>
  );
}

function ClockBox({
  x,
  y,
  label,
  clock,
}: {
  x: number;
  y: number;
  label: string;
  clock: number;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r="15" className="clock-circle" />

      <text x={x} y={y + 4} textAnchor="middle" className="clock-text">
        {clock}
      </text>

      <text x={x} y={y + 30} textAnchor="middle" className="clock-name">
        {label}
      </text>
    </g>
  );
}

function QueueState({
  processId,
  y,
  entries,
}: {
  processId: number;
  y: number;
  entries: {
    type: string;
    timestamp: number;
    processId: number;
  }[];
}) {
    const queueX: Record<number, number> = {
    1: 350,
    2: 550,
    3: 750,
  };

  const x = queueX[processId];

  const displayType = (type: string) => {
    if (type === "ACQ") return "ACK";
    if (type === "REL") return "LIB";
    return type;
  };

  const slots = [
    entries.find((e) => e.processId === 1) ?? null,
    entries.find((e) => e.processId === 2) ?? null,
    entries.find((e) => e.processId === 3) ?? null,
  ];

  const classFor = (type: string) => {
    if (type === "REQ") return "queue-slot req";
    if (type === "ACQ") return "queue-slot ack";
    if (type === "REL") return "queue-slot lib";
    return "queue-slot empty";
  };

  return (
    <g className="queue-card">
      <rect
        x={x - 62}
        y={y - 35}
        width="124"
        height="122"
        rx="14"
        className="queue-bg"
      />

      <text x={x} y={y - 14} textAnchor="middle" className="queue-title">
        Fa[{processId}]
      </text>

      {slots.map((slot, index) => {
        const yy = y + index * 25;

        return (
          <g key={index}>
            <text
              x={x - 50}
              y={yy + 15}
              textAnchor="middle"
              className="queue-index"
            >
              P{index + 1}
            </text>

            <rect
              x={x - 32}
              y={yy}
              width="84"
              height="22"
              rx="8"
              className={slot ? classFor(slot.type) : "queue-slot empty"}
            />

            <text x={x + 10} y={yy + 15} textAnchor="middle" className="queue-cell">
              {slot
                ? `${displayType(slot.type)}(${slot.processId},${slot.timestamp})`
                : "-"}
            </text>
          </g>
        );
      })}
    </g>
  );
}


function CriticalSectionLine({
  step,
  currentStepNum,
}: {
  step: LamportStep;
  currentStepNum: number;
}) {
  const enters = step.events.filter((e) => e.type === "ENTER_CS");

  return (
    <g>
      {enters.map((enter) => {
        if (!enter.from) return null;

        const y = processY[enter.from];

        let x1: number;

        if (enter.from === 1) {
          x1 = eventX(enter) - 215;
        } else if (enter.from === 2) {
          x1 = eventX(enter) - 315;
        } else {
          x1 = eventX(enter) - 215;
        }

        const x2 = x1 + SC_WIDTH[enter.from];

        const isVisible = enter.step <= currentStepNum;

        if (!isVisible) return null;

        return (
          <g key={enter.id}>
            <line
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              className="critical-section-line"
            />

            <text
              x={(x1 + x2) / 2}
              y={y + 20}
              textAnchor="middle"
              className="critical-section-text"
            >
              Section critique
            </text>
          </g>
        );
      })}
    </g>
  );
}