import type { Step } from "../algorithms/mutex/ricartToken/ricartTokenAlgo";
import "../styles/ricartToken.css";

type Props = {
  step: Step;
  previousStep?: Step;
};

const positions: Record<number, { x: number; y: number }> = {
  1: { x: 320, y: 70 },
  2: { x: 500, y: 180 },
  3: { x: 430, y: 350 },
  4: { x: 210, y: 350 },
  5: { x: 140, y: 180 },
};

const colors: Record<number, string> = {
  1: "#2563eb",
  2: "#059669",
  3: "#d97706",
  4: "#7c3aed",
  5: "#dc2626",
};

function stateLabel(state: string) {
  if (state === "dehors") return "OUT";
  if (state === "demandeur") return "REQ";
  return "SC";
}

export default function RicartTokenTimeline({ step, previousStep }: Props) {
  return (
    <svg
      className="ricart-token-svg"
      viewBox="0 0 640 420"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id="ricartArrow"
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
        >
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#2563eb" />
        </marker>

        <filter id="scGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Réseau maillé */}
      {step.sites.flatMap((s1) =>
        step.sites
          .filter((s2) => s2.id > s1.id)
          .map((s2) => (
            <line
              key={`${s1.id}-${s2.id}`}
              x1={positions[s1.id].x}
              y1={positions[s1.id].y}
              x2={positions[s2.id].x}
              y2={positions[s2.id].y}
              className="ricart-mesh-edge"
            />
          ))
      )}

      {/* Messages actifs */}
      {step.messages.map((msg) => {
        const from = positions[msg.from];
        const to = positions[msg.to];

        return (
          <g key={msg.id}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={
                msg.type === "TOKEN"
                  ? "ricart-active-token-edge"
                  : "ricart-active-req-edge"
              }
              markerEnd="url(#ricartArrow)"
            />

            <rect
              x={(from.x + to.x) / 2 - 24}
              y={(from.y + to.y) / 2 - 12}
              width="75"
              height="20"
              rx="10"
              className={
                msg.type === "TOKEN"
                  ? "ricart-msg-token-badge"
                  : "ricart-msg-req-badge"
              }
            />

            <text
              x={(from.x + to.x) / 2 + 15 }
              y={(from.y + to.y) / 2 }
              className="ricart-msg-label"
            >
              {msg.type === "TOKEN" && "token" in msg
                ? `J=[${msg.token.join(",")}]`
                : "REQ"}
            </text>
          </g>
        );
      })}

      {/* Nœuds */}
      {step.sites.map((site) => {
        const pos = positions[site.id];
        const color = colors[site.id];
        const isActive = step.activeSite === site.id;
        const isReq = site.etat === "demandeur";
        const isSC = site.etat === "dedans";

        return (
          <g key={site.id}>
            {isActive && (
              <>
                <circle cx={pos.x} cy={pos.y} r="38" fill={color} opacity="0.06" />
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="32"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                  opacity="0.35"
                />
              </>
            )}

            {isReq && (
              <>
                {/* halo lumineux */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="50"
                  className="ricart-req-glow"
                />

                {/* cercle simple */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="26"
                  fill={`${color}20`}
                />

                {/* label */}
                <text x={pos.x} y={pos.y - 47} className="ricart-req-text">
                  WAIT
                </text>
              </>
            )}

            {isSC && (
              <>
                <circle cx={pos.x} cy={pos.y} r="50" className="ricart-sc-light" />
                <circle cx={pos.x} cy={pos.y} r="42" className="ricart-sc-ring" />
                <rect
                  x={pos.x - 24}
                  y={pos.y - 57}
                  width="48"
                  height="17"
                  rx="8.5"
                  className="ricart-sc-badge"
                />
                <text x={pos.x} y={pos.y - 48} className="ricart-sc-text">
                  IN SC
                </text>
              </>
            )}

            <circle
              cx={pos.x}
              cy={pos.y}
              r={isSC ? 30 : 26}
              fill={isSC ? "rgba(255,247,237,0.96)" : `${color}12`}
              stroke={isSC ? "#f97316" : isReq ? "#f59e0b" : color}
              strokeWidth={isSC ? 2.5 : isReq ? 2 : isActive ? 2 : 1.2}
              filter={isSC ? "url(#scGlow)" : undefined}
            />

            <text
              x={pos.x}
              y={pos.y - 5}
              className="ricart-node-title"
              fill={isSC ? "#ea580c" : isReq ? "#d97706" : color}
            >
              P{site.id}
            </text>

            <text
              x={pos.x}
              y={pos.y + 12}
              className="ricart-node-state"
              fill={isSC ? "#ea580c" : isReq ? "#d97706" : color}
            >
              {stateLabel(site.etat)}
            </text>

            {site.jetonPresent && (
              <g className="ricart-token-floating">
                <rect
                  x={pos.x - 58}
                  y={pos.y - 62}
                  width="116"
                  height="26"
                  rx="13"
                  className="ricart-token-box"
                />

                <text
                  x={pos.x}
                  y={pos.y - 48}
                  className="ricart-token-label"
                >
                  J=[{step.token.join(",")}]
                </text>
              </g>
            )}


            

            <g className="ricart-req-card">
              <rect
                x={pos.x - 54}
                y={pos.y + 30}
                width="108"
                height="24"
                rx="10"
                className="ricart-req-card-bg"
              />

              <text
                x={pos.x}
                y={pos.y + 43}
                className={`ricart-req-values ${
                  step.activeSite === site.id ? "req-highlight" : ""
                }`}
              >
                Req [
                {site.req.map((value, i) => {
                  const prev = previousStep?.sites.find(s => s.id === site.id)?.req[i];

                  const changed = prev !== undefined && prev !== value;

                  return (
                    <tspan
                      key={i}
                      className={changed ? "req-value-changed" : ""}
                    >
                      {value}
                      {i < site.req.length - 1 ? "," : ""}
                    </tspan>
                  );
                })}
                ]
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}