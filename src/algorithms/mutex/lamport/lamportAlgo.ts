import type {
  LamportStep,
  ProcessNode,
  QueueEntry,
  LamportEvent,
  MessageType,
} from "./types";

type SiteId = 1 | 2 | 3;

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
    queues[owner][index] = entry; // remplace uniquement la case concernée
  } else {
    queues[owner].push(entry); // ajoute si la case n’existe pas
  }

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

function sendMessage(
  type: MessageType,
  from: SiteId,
  to: SiteId,
  label: string,
  sendClock: number,
  receiveClock: number,
  x: number,
  dx: number,
  processes: ProcessNode[],
  queues: Record<number, QueueEntry[]>,
  events: LamportEvent[],
  logs: string[],
  labelDy = -70,
  clockDy = -16
) {
  const sender = getProcess(processes, from);
  const receiver = getProcess(processes, to);

  sender.clock = sendClock;
  receiver.clock = receiveClock;

  if (type === "REQ") {
    setQueueEntry(queues, to, {
      type: "REQ",
      processId: from,
      timestamp: sendClock,
    });
  }

  if (type === "ACQ") {
    const existing = queues[to].find((e) => e.processId === from);

    if (!existing || existing.type !== "REQ") {
      setQueueEntry(queues, to, {
        type: "ACQ",
        processId: from,
        timestamp: sendClock,
      });
    }
  }

  if (type === "REL") {
    setQueueEntry(queues, to, {
      type: "REL",
      processId: from,
      timestamp: sendClock,
    });
  }

  events.push({
    id: eventId++,
    type,
    from,
    to,
    timestamp: sendClock,
    receiveTimestamp: receiveClock,
    label,
    step: events.length + 1,
    x,
    dx,
    labelDy,
    clockDy,
  });

  logs.push(`P${from} → P${to} : ${label}`);
}

function localRequest(
  site: SiteId,
  requestClock: number,
  processes: ProcessNode[],
  queues: Record<number, QueueEntry[]>,
  logs: string[]
) {
  const process = getProcess(processes, site);

  process.clock = requestClock;
  process.status = "requesting";

  setQueueEntry(queues, site, {
    type: "REQ",
    processId: site,
    timestamp: requestClock,
  });

  logs.push(`P${site} demande la SC : REQ(${site},${requestClock})`);
}

function enterCS(
  site: SiteId,
  processes: ProcessNode[],
  events: LamportEvent[],
  logs: string[]
) {
  const process = getProcess(processes, site);

  process.clock += 1;
  process.status = "in_cs";

  events.push({
    id: eventId++,
    type: "ENTER_CS",
    from: site,
    timestamp: process.clock,
    label: `P${site} entre SC`,
    step: events.length + 1,
  });

  logs.push(`P${site} entre en section critique.`);
}

function exitCS(
  site: SiteId,
  processes: ProcessNode[],
  queues: Record<number, QueueEntry[]>,
  events: LamportEvent[],
  logs: string[]
) {
  const process = getProcess(processes, site);

  process.clock += 1;
  process.status = "released";

  setQueueEntry(queues, site, {
    type: "REL",
    processId: site,
    timestamp: process.clock,
  });

  events.push({
    id: eventId++,
    type: "EXIT_CS",
    from: site,
    timestamp: process.clock,
    label: `P${site} sort SC`,
    step: events.length + 1,
  });

  logs.push(`P${site} sort de la section critique.`);
}

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

localRequest(1,1, processes, queues, logs);

addStep(
  steps,
  "P1 demande la section critique",
  "P1 incrémente son horloge et place REQ(1,1) dans sa file locale.",
  processes,
  queues,
  events,
  logs
);

sendMessage("REQ", 1, 2, "R(1,1)", 1, 2, 120, 195, processes, queues, events, logs);

addStep(
  steps,
  "P1 envoie REQ à P2",
  "P2 reçoit la requête de P1 et met à jour son horloge logique.",
  processes,
  queues,
  events,
  logs
);

sendMessage("REQ", 1, 3, "R(1,1)", 1, 2, 120, 125, processes, queues, events, logs);

addStep(
  steps,
  "P1 envoie REQ à P3",
  "P3 reçoit la requête de P1.",
  processes,
  queues,
  events,
  logs
);

localRequest(2,1, processes, queues, logs);

addStep(
  steps,
  "P2 demande aussi la section critique",
  "P2 crée sa propre requête REQ(2,1). En cas d'égalité, P1 reste prioritaire car son identifiant est plus petit.",
  processes,
  queues,
  events,
  logs
);

sendMessage("REQ", 2, 1, "R(2,1)", 1, 2, 120, 95, processes, queues, events, logs);

addStep(
  steps,
  "P2 envoie REQ à P1",
  "P1 reçoit la requête de P2.",
  processes,
  queues,
  events,
  logs
);

sendMessage("REQ", 2, 3, "R(2,1)", 1, 3, 120, 250, processes, queues, events, logs);

addStep(
  steps,
  "P2 envoie REQ à P3",
  "P3 connaît maintenant les deux demandes : celle de P1 et celle de P2.",
  processes,
  queues,
  events,
  logs
);

sendMessage("ACQ", 1, 2, "A(1,3)", 3, 4, 300, 85, processes, queues, events, logs);

addStep(
  steps,
  "P1 acquitte la requête de P2",
  "Après réception de REQ(2,1), P1 envoie ACK à P2.",
  processes,
  queues,
  events,
  logs
);

sendMessage("ACQ", 2, 1, "A(2,5)", 5, 6, 400, 90, processes, queues, events, logs);

addStep(
  steps,
  "P2 acquitte la requête de P1",
  "Après réception de REQ(1,1), P2 envoie ACK à P1.",
  processes,
  queues,
  events,
  logs
);

sendMessage("ACQ", 3, 1, "A(3,4)", 4, 7, 450, 105, processes, queues, events, logs);

addStep(
  steps,
  "P3 acquitte P1",
  "P3 envoie ACK à P1 après avoir reçu sa requête.",
  processes,
  queues,
  events,
  logs
);

sendMessage("ACQ", 3, 2, "A(3,5)", 5, 6, 500, 90, processes, queues, events, logs);

addStep(
  steps,
  "P3 acquitte P2",
  "P3 envoie aussi ACK à P2.",
  processes,
  queues,
  events,
  logs
);

enterCS(1, processes, events, logs);

addStep(
  steps,
  "P1 entre en section critique",
  "P1 a reçu tous les ACK et sa requête est la plus prioritaire.",
  processes,
  queues,
  events,
  logs
);

exitCS(1, processes, queues, events, logs);

addStep(
  steps,
  "P1 sort de la section critique",
  "P1 libère la ressource critique.",
  processes,
  queues,
  events,
  logs
);

sendMessage("REL", 1, 2, "L(1,8)", 8, 9, 700, 75, processes, queues, events, logs);

addStep(
  steps,
  "P1 envoie LIB à P2",
  "P2 apprend que P1 a libéré la section critique.",
  processes,
  queues,
  events,
  logs
);

sendMessage("REL", 1, 3, "L(1,8)", 8, 9, 700, 90, processes, queues, events, logs);

addStep(
  steps,
  "P1 envoie LIB à P3",
  "P3 apprend aussi que P1 a libéré la section critique.",
  processes,
  queues,
  events,
  logs
);

enterCS(2, processes, events, logs);

addStep(
  steps,
  "P2 entre en section critique",
  "Après la libération de P1, la requête de P2 devient prioritaire.",
  processes,
  queues,
  events,
  logs
);

exitCS(2, processes, queues, events, logs);

addStep(
  steps,
  "P2 sort de la section critique",
  "P2 termine son accès à la ressource critique.",
  processes,
  queues,
  events,
  logs
);

sendMessage("REL", 2, 1, "L(2,10)", 10, 11, 900, 80, processes, queues, events, logs);

addStep(
  steps,
  "P2 envoie LIB à P1",
  "P1 apprend que P2 a libéré la section critique.",
  processes,
  queues,
  events,
  logs
);

sendMessage("REL", 2, 3, "L(2,10)", 10, 11, 900, 80, processes, queues, events, logs);

addStep(
  steps,
  "P2 envoie LIB à P3",
  "Fin du scénario : P1 puis P2 ont accédé à la section critique sans conflit.",
  processes,
  queues,
  events,
  logs
);

  return steps;
}

export const lamportSteps = generateLamportScenario();4























