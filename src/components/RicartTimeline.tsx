import type {
  RicartStep,
  RicartEvent,
} from "../algorithms/mutex/ricart-agrawala/types";
import "../styles/ricart.css";

type Props = {
  step: RicartStep;
};

const processY: Record<number, number> = {
  1: 30,
  2: 180,
  3: 330,
};

const SVG_WIDTH = 1500;
const SVG_HEIGHT = 620;
const AXIS_START = 110;
const AXIS_END = 1150;

const eventX = (event: RicartEvent) => {
  if (event.x !== undefined) return event.x;
  return 50 + event.step * 85;
};

const eventDx = (event: RicartEvent) => {
  if (event.dx !== undefined) return event.dx;
  return 80;
};

export default function RicartTimeline({ step }: Props) {
  const currentStepNum = step.id;

  return (
    <div className="ricart-scroll">
      <svg
        className="ricart-svg"
        width="100%"
        height="100%"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="ricart-arrow-blue" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#2563EB" />
          </marker>

          <marker id="ricart-arrow-green" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#059669" />
          </marker>
        </defs>

      <g transform="scale(1.4)">
        {step.processes.map((p) => (
          <g key={p.id}>
            <text x="40" y={processY[p.id] - 18} className="ricart-site">
              Site {p.id}
            </text>

            <line
              x1={AXIS_START}
              y1={processY[p.id]}
              x2={AXIS_END}
              y2={processY[p.id]}
              className="ricart-axis"
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

          if (
              event.type !== "SEND_REQUEST" &&
              event.type !== "SEND_REPLY" &&
              event.type !== "RECEIVE_REQUEST" &&
              event.type !== "RECEIVE_REPLY"
            ) {
              return null;
            }

          if (!event.to) return null;

          return (
            <MessageEvent
              key={event.id}
              event={event}
              isActive={event.step === currentStepNum}
            />
          );
        })}

        <RicartStateCards step={step} y={420} />
      </g>
      </svg>
    </div>
  );
}

function MessageEvent({
  event,
  isActive,
}: {
  event: RicartEvent;
  isActive: boolean;
}) {
  const x1 = eventX(event);
  const x2 = x1 + eventDx(event);

  const y1 = processY[event.from];
  const y2 = processY[event.to!];

  const isRequest = event.type === "SEND_REQUEST" || event.type === "RECEIVE_REQUEST";  

  const color = isRequest ? "#2563EB" : "#059669";
  const marker = isRequest ? "url(#ricart-arrow-blue)" : "url(#ricart-arrow-green)";

  const padding = 16;
  const charWidth = 7; // approx largeur d’un caractère
  const width = event.label.length * charWidth + padding;

  const labelDy = event.labelDy ?? -70;
  const clockDy = event.clockDy ?? 28;

  return (
    <g className={`ricart-event ${isActive ? "ricart-active-event" : ""}`}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        markerEnd={marker}
        className={`ricart-message ${!isRequest ? "ricart-reply-dashed" : ""}`}
      />

        

      {event.label && (
        <g className={`ricart-event-label ${isActive ? "show-label" : ""}`}>
          <g className="ricart-label-group">

            <rect
                x={(x1 + x2) / 2 - width / 2}
                y={(y1 + y2) / 2 + labelDy - 16}
                width={width}
                height="24"
                rx="10"
                className={`ricart-label-bg ${isRequest ? "req" : "reply"}`}
              />

            <text
              x={(x1 + x2) / 2}
              y={(y1 + y2) / 2 + labelDy}
              textAnchor="middle"
              className="ricart-label"
            >
              {event.label}
            </text>
          </g>
        </g>
      )}

      <EventClock x={x1 + 5} y={y1 + clockDy - 45} value={event.timestamp} />

      <EventClock
        x={x2 - 18}
        y={y2 - 16}
        value={event.receiveTimestamp}
      />
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
    <g className="ricart-event-clock">
      <rect x={x - 16} y={y - 10} width="32" height="17" rx="8.5" />
      <text x={x} y={y + 3} textAnchor="middle">
        H={value}
      </text>
    </g>
  );
}

function CriticalEvent({ event }: { event: RicartEvent }) {
  const x = eventX(event);
  const y = processY[event.from];

  const isEnter = event.type === "ENTER_CS";

  const positions = {
  enter: {
    1: { badgeX: -170, textX: -120, badgeY: -38, textY: -21 },
    2: { badgeX: -280, textX: -230, badgeY: -40, textY: -25 },
    3: { badgeX: -160, textX: -110, badgeY: -50, textY: -32 },
  },
  exit: {
    1: { badgeX: -100, textX: -50, badgeY: -15, textY: 1 },
    2: { badgeX: -140, textX: -90, badgeY: - 15, textY: 1 },
    3: { badgeX: 0, textX: 100, badgeY: -40, textY: -20 },
  },
};

const cfg = isEnter
  ? positions.enter[event.from]
  : positions.exit[event.from];

const badgeX = x + cfg.badgeX;
const textX  = x + cfg.textX;

const badgeY = y + cfg.badgeY;
const textY  = y + cfg.textY;


  return (
  <g className="ricart-event ricart-critical-event">
    <rect
      x={badgeX}
      y={badgeY}
      width="98"
      height="25"
      rx="9"
      className={isEnter ? "ricart-cs-enter" : "ricart-cs-exit"}
    />

    <text
      x={textX}
      y={textY}
      textAnchor="middle"
      className="ricart-cs-label"
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
      <circle cx={x} cy={y} r="17" className="ricart-clock-circle" />

      <text x={x} y={y + 4} textAnchor="middle" className="ricart-clock-text">
        {clock}
      </text>

      <text x={x} y={y + 32} textAnchor="middle" className="ricart-clock-name">
        {label}
      </text>
    </g>
  );
}

function CriticalSectionLine({
  step,
  currentStepNum,
}: {
  step: RicartStep;
  currentStepNum: number;
}) {
  const enters = step.events.filter((e) => e.type === "ENTER_CS");

  return (
    <g>
      {enters.map((enter) => {
        const y = processY[enter.from];
        
        if (enter.step > currentStepNum) return null;

        const x1 = enter.from === 2 ? eventX(enter) - 280 : eventX(enter) - 215;
        const scLength: Record<number, number> = {
          1: 180, // longueur SC de P1
          2: 100, // longueur SC de P2
          3: 200,
        };

       
        const x2 = x1 + scLength[enter.from];

        return (
          <g key={enter.id}>
            <line
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              className="ricart-cs-line"
            />

            <text
              x={(x1 + x2) / 2}
              y={y + 20}
              textAnchor="middle"
              className="ricart-cs-text"
            >
              Section critique
            </text>
          </g>
        );
      })}
    </g>
  );
}

function RicartStateCards({
  step,
  y,
}: {
  step: RicartStep;
  y: number;
}) {
  const cardX: Record<number, number> = {
    1: 350,
    2: 550,
    3: 750,
  };

  return (
    <>
      {step.processes.map((p) => {
        const x = cardX[p.id];

        const pending = step.pendingReplies[p.id] ?? [];
        const deferred = step.deferredReplies[p.id] ?? [];

        return (
          <g key={`state-${p.id}`} className="ricart-state-card-group">
            <rect
              x={x - 78}
              y={y - 35}
              width="156"
              height="122"
              rx="14"
              className="ricart-state-card"
            />

            <text x={x} y={y - 14} textAnchor="middle" className="ricart-state-title">
              Etat P{p.id}
            </text>

            <StateRow
              x={x}
              y={y}
              label="Attend"
              value={pending.length ? pending.map((id) => `P${id}`).join(",") : "-"}
              type="req"
            />

            <StateRow
              x={x}
              y={y + 28}
              label="Diffère"
              value={deferred.length ? deferred.map((id) => `P${id}`).join(",") : "-"}
              type="reply"
            />

            <StateRow
              x={x}
              y={y + 56}
              label="Statut"
              value={p.status}
              type={p.status === "in_cs" ? "cs" : "empty"}
            />
          </g>
        );
      })}
    </>
  );
}

function StateRow({
  x,
  y,
  label,
  value,
  type,
}: {
  x: number;
  y: number;
  label: string;
  value: string;
  type: "req" | "reply" | "cs" | "empty";
}) {
  return (
    <g>
      <text x={x - 56} y={y + 15} textAnchor="middle" className="ricart-state-label">
        {label}
      </text>

      <rect
        x={x - 32}
        y={y}
        width="92"
        height="22"
        rx="8"
        className={`ricart-state-slot ${type}`}
      />

      <text x={x + 14} y={y + 15} textAnchor="middle" className="ricart-state-text">
        {value}
      </text>
    </g>
  );
}