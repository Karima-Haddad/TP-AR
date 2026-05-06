import type {
  LamportStep,
  ProcessNode,
  QueueEntry,
  LamportEvent,
  MessageType,
} from "./types";

type SiteId = 1 | 2 | 3;

type Action =
  | { kind: "REQUEST_CS"; site: SiteId; clock: number }
  | {
      kind: "DELIVER_REQ";
      from: SiteId;
      to: SiteId;
      sendClock: number;
      receiveClock: number;
      x: number;
      dx: number;
    }
  | {
      kind: "DELIVER_ACK";
      from: SiteId;
      to: SiteId;
      sendClock: number;
      receiveClock: number;
      x: number;
      dx: number;
    }
  | { kind: "TRY_ENTER"; site: SiteId }
  | { kind: "EXIT_CS"; site: SiteId }
  | {
      kind: "DELIVER_REL";
      from: SiteId;
      to: SiteId;
      sendClock: number;
      receiveClock: number;
      x: number;
      dx: number;
    };

const sites: SiteId[] = [1, 2, 3];

let eventId = 1;

function initialProcesses(): ProcessNode[] {
  return sites.map((id) => ({
    id,
    name: `P${id}`,
    clock: 0,
    status: "idle",
  }));
}

function cloneProcesses(processes: ProcessNode[]): ProcessNode[] {
  return processes.map((p) => ({ ...p }));
}

function cloneQueues(
  queues: Record<number, QueueEntry[]>
): Record<number, QueueEntry[]> {
  return {
    1: [...queues[1]],
    2: [...queues[2]],
    3: [...queues[3]],
  };
}

function getProcess(processes: ProcessNode[], id: SiteId): ProcessNode {
  return processes.find((p) => p.id === id)!;
}

function setQueueEntry(
  queues: Record<number, QueueEntry[]>,
  owner: SiteId,
  entry: QueueEntry
) {
  const index = queues[owner].findIndex(
    (e) => e.processId === entry.processId
  );

  if (index !== -1) {
    queues[owner][index] = entry;
  } else {
    queues[owner].push(entry);
  }

  queues[owner].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.processId - b.processId;
  });
}

function hasAllAck(site: SiteId, queues: Record<number, QueueEntry[]>): boolean {
  return sites
    .filter((s) => s !== site)
    .every((other) =>
      queues[site].some(
        (e) => e.processId === other && (e.type === "ACQ" || e.type === "REL")
      )
    );
}

function hasPriority(
  site: SiteId,
  queues: Record<number, QueueEntry[]>
): boolean {
  const activeRequests = queues[site]
    .filter((e) => e.type === "REQ")
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.processId - b.processId;
    });

  return activeRequests[0]?.processId === site;
}

function addStep(
  steps: LamportStep[],
  title: string,
  description: string,
  processes: ProcessNode[],
  queues: Record<number, QueueEntry[]>,
  events: LamportEvent[],
  logs: string[]
) {
  steps.push({
    title,
    description,
    state: {
      currentStep: steps.length,
      processes: cloneProcesses(processes),
      queues: cloneQueues(queues),
      messages: [],
      logs: [...logs],
    },
    events: [...events],
  });
}

function pushEvent(
  events: LamportEvent[],
  type: MessageType | "ENTER_CS" | "EXIT_CS",
  from: SiteId,
  timestamp: number,
  label: string,
  x?: number,
  dx?: number,
  to?: SiteId,
  receiveTimestamp?: number
) {
  events.push({
    id: eventId++,
    type,
    from,
    to,
    timestamp,
    receiveTimestamp,
    label,
    step: events.length + 1,
    x,
    dx,
    labelDy: -70,
    clockDy: -16,
  } as LamportEvent);
}

function executeAction(
  action: Action,
  processes: ProcessNode[],
  queues: Record<number, QueueEntry[]>,
  events: LamportEvent[],
  logs: string[]
): { title: string; description: string } {
  switch (action.kind) {
    case "REQUEST_CS": {
      const p = getProcess(processes, action.site);

      p.clock = action.clock;
      p.status = "requesting";

      setQueueEntry(queues, action.site, {
        type: "REQ",
        processId: action.site,
        timestamp: action.clock,
      });

      logs.push(
        `P${action.site} demande la SC : REQ(${action.site},${action.clock})`
      );

      return {
        title: `P${action.site} demande la section critique`,
        description: `P${action.site} incrémente son horloge et place REQ(${action.site},${action.clock}) dans sa file locale.`,
      };
    }

    case "DELIVER_REQ": {
      const sender = getProcess(processes, action.from);
      const receiver = getProcess(processes, action.to);

      sender.clock = action.sendClock;
      receiver.clock = action.receiveClock;

      setQueueEntry(queues, action.to, {
        type: "REQ",
        processId: action.from,
        timestamp: action.sendClock,
      });

      pushEvent(
        events,
        "REQ",
        action.from,
        action.sendClock,
        `R(${action.from},${action.sendClock})`,
        action.x,
        action.dx,
        action.to,
        action.receiveClock
      );

      logs.push(
        `P${action.from} → P${action.to} : REQUEST(${action.from},${action.sendClock})`
      );

      return {
        title: `P${action.from} envoie REQ à P${action.to}`,
        description: `P${action.to} reçoit la requête de P${action.from} et met à jour son horloge logique.`,
      };
    }

    case "DELIVER_ACK": {
      const sender = getProcess(processes, action.from);
      const receiver = getProcess(processes, action.to);

      sender.clock = action.sendClock;
      receiver.clock = action.receiveClock;

      const existingReq = queues[action.to].find(
        (e) => e.processId === action.from && e.type === "REQ"
      );

      if (!existingReq) {
        setQueueEntry(queues, action.to, {
          type: "ACQ",
          processId: action.from,
          timestamp: action.sendClock,
        });
      } else {
        setQueueEntry(queues, action.to, {
          type: "ACQ",
          processId: action.from,
          timestamp: action.sendClock,
        });
      }

      pushEvent(
        events,
        "ACQ",
        action.from,
        action.sendClock,
        `A(${action.from},${action.sendClock})`,
        action.x,
        action.dx,
        action.to,
        action.receiveClock
      );

      logs.push(
        `P${action.from} → P${action.to} : ACK(${action.from},${action.sendClock})`
      );

      return {
        title: `P${action.from} acquitte P${action.to}`,
        description: `P${action.from} envoie ACK à P${action.to}.`,
      };
    }

    case "TRY_ENTER": {
      const p = getProcess(processes, action.site);

      if (hasAllAck(action.site, queues) && hasPriority(action.site, queues)) {
        p.clock += 1;
        p.status = "in_cs";

        pushEvent(
          events,
          "ENTER_CS",
          action.site,
          p.clock,
          `P${action.site} entre SC`
        );

        logs.push(`P${action.site} entre en section critique.`);

        return {
          title: `P${action.site} entre en section critique`,
          description: `P${action.site} a reçu tous les ACK et sa requête est la plus prioritaire.`,
        };
      }

      logs.push(`P${action.site} ne peut pas encore entrer en section critique.`);

      return {
        title: `P${action.site} tente d’entrer en section critique`,
        description: `P${action.site} ne peut pas encore entrer car toutes les conditions ne sont pas satisfaites.`,
      };
    }

    case "EXIT_CS": {
      const p = getProcess(processes, action.site);

      p.clock += 1;
      p.status = "released";

      setQueueEntry(queues, action.site, {
        type: "REL",
        processId: action.site,
        timestamp: p.clock,
      });

      pushEvent(
        events,
        "EXIT_CS",
        action.site,
        p.clock,
        `P${action.site} sort SC`
      );

      logs.push(`P${action.site} sort de la section critique.`);

      return {
        title: `P${action.site} sort de la section critique`,
        description: `P${action.site} libère la ressource critique.`,
      };
    }

    case "DELIVER_REL": {
      const sender = getProcess(processes, action.from);
      const receiver = getProcess(processes, action.to);

      sender.clock = action.sendClock;
      receiver.clock = action.receiveClock;

      setQueueEntry(queues, action.to, {
        type: "REL",
        processId: action.from,
        timestamp: action.sendClock,
      });

      pushEvent(
        events,
        "REL",
        action.from,
        action.sendClock,
        `L(${action.from},${action.sendClock})`,
        action.x,
        action.dx,
        action.to,
        action.receiveClock
      );

      logs.push(
        `P${action.from} → P${action.to} : LIB(${action.from},${action.sendClock})`
      );

      return {
        title: `P${action.from} envoie LIB à P${action.to}`,
        description: `P${action.to} apprend que P${action.from} a libéré la section critique.`,
      };
    }
  }
}

const scenario: Action[] = [
  { kind: "REQUEST_CS", site: 1, clock: 1 },

  {
    kind: "DELIVER_REQ",
    from: 1,
    to: 2,
    sendClock: 1,
    receiveClock: 2,
    x: 120,
    dx: 195,
  },
  {
    kind: "DELIVER_REQ",
    from: 1,
    to: 3,
    sendClock: 1,
    receiveClock: 2,
    x: 120,
    dx: 125,
  },

  { kind: "REQUEST_CS", site: 2, clock: 1 },

  {
    kind: "DELIVER_REQ",
    from: 2,
    to: 1,
    sendClock: 1,
    receiveClock: 2,
    x: 120,
    dx: 95,
  },
  {
    kind: "DELIVER_REQ",
    from: 2,
    to: 3,
    sendClock: 1,
    receiveClock: 3,
    x: 120,
    dx: 250,
  },

  {
    kind: "DELIVER_ACK",
    from: 1,
    to: 2,
    sendClock: 3,
    receiveClock: 4,
    x: 300,
    dx: 85,
  },
  {
    kind: "DELIVER_ACK",
    from: 2,
    to: 1,
    sendClock: 5,
    receiveClock: 6,
    x: 400,
    dx: 90,
  },
  {
    kind: "DELIVER_ACK",
    from: 3,
    to: 1,
    sendClock: 4,
    receiveClock: 7,
    x: 450,
    dx: 105,
  },
  {
    kind: "DELIVER_ACK",
    from: 3,
    to: 2,
    sendClock: 5,
    receiveClock: 6,
    x: 500,
    dx: 90,
  },

  { kind: "TRY_ENTER", site: 1 },
  { kind: "EXIT_CS", site: 1 },

  {
    kind: "DELIVER_REL",
    from: 1,
    to: 2,
    sendClock: 8,
    receiveClock: 9,
    x: 700,
    dx: 75,
  },
  {
    kind: "DELIVER_REL",
    from: 1,
    to: 3,
    sendClock: 8,
    receiveClock: 9,
    x: 700,
    dx: 90,
  },

  { kind: "TRY_ENTER", site: 2 },
  { kind: "EXIT_CS", site: 2 },

  {
    kind: "DELIVER_REL",
    from: 2,
    to: 1,
    sendClock: 10,
    receiveClock: 11,
    x: 900,
    dx: 80,
  },
  {
    kind: "DELIVER_REL",
    from: 2,
    to: 3,
    sendClock: 10,
    receiveClock: 11,
    x: 900,
    dx: 80,
  },
];

export function generateLamportScenario(): LamportStep[] {
  eventId = 1;

  const steps: LamportStep[] = [];
  const processes = initialProcesses();

  const queues: Record<number, QueueEntry[]> = {
    1: [],
    2: [],
    3: [],
  };

  const events: LamportEvent[] = [];
  const logs: string[] = [];

  addStep(
    steps,
    "État initial",
    "Tous les sites sont au repos. Les horloges commencent à 0.",
    processes,
    queues,
    events,
    logs
  );

  for (const action of scenario) {
    const result = executeAction(action, processes, queues, events, logs);

    addStep(
      steps,
      result.title,
      result.description,
      processes,
      queues,
      events,
      logs
    );
  }

  return steps;
}

export const lamportSteps = generateLamportScenario();