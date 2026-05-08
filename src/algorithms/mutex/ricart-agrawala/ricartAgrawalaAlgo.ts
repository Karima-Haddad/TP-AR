import type {
  ProcessNode,
  RicartEvent,
  RicartMessage,
  RicartStep,
  SiteId,
  MessageType,
} from "./types";

type Action =
  | { kind: "REQUEST_CS"; site: SiteId }
  | { kind: "DELIVER_REQUEST"; from: SiteId; to: SiteId }
  | { kind: "DELIVER_REPLY"; from: SiteId; to: SiteId }
  | { kind: "TRY_ENTER_CS"; site: SiteId }
  | { kind: "EXIT_CS"; site: SiteId };

const sites: SiteId[] = [1, 2, 3];

let messageId = 1;
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

function cloneRecord(record: Record<SiteId, SiteId[]>): Record<SiteId, SiteId[]> {
  return {
    1: [...record[1]],
    2: [...record[2]],
    3: [...record[3]],
  };
}

function getProcess(processes: ProcessNode[], id: SiteId): ProcessNode {
  return processes.find((p) => p.id === id)!;
}

function otherSites(site: SiteId): SiteId[] {
  return sites.filter((s) => s !== site);
}

function incrementClock(process: ProcessNode): number {
  process.clock += 1;
  return process.clock;
}

function updateClockOnReceive(receiver: ProcessNode, messageClock: number): number {
  receiver.clock = Math.max(receiver.clock, messageClock) + 1;
  return receiver.clock;
}

function hasPriority(requester: ProcessNode, receiver: ProcessNode): boolean {
  if (receiver.status !== "requesting") return true;

  const requesterTimestamp = requester.requestTimestamp!;
  const receiverTimestamp = receiver.requestTimestamp!;

  if (requesterTimestamp < receiverTimestamp) return true;

  if (requesterTimestamp === receiverTimestamp) {
    return requester.id < receiver.id;
  }

  return false;
}

function createMessage(
  type: MessageType,
  from: SiteId,
  to: SiteId,
  timestamp: number
): RicartMessage {
  return {
    id: messageId++,
    type,
    from,
    to,
    timestamp,
  };
}

function createEvent(
  step: number,
  type: RicartEvent["type"],
  from: SiteId,
  timestamp: number,
  label: string,
  to?: SiteId,
  options?: {
    receiveTimestamp?: number;
    x?: number;
    dx?: number;
    labelDy?: number;
    clockDy?: number;
  }
): RicartEvent {
  return {
    id: eventId++,
    step,
    type,
    from,
    to,
    timestamp,
    label,
    receiveTimestamp: options?.receiveTimestamp,
    x: options?.x,
    dx: options?.dx,
    labelDy: options?.labelDy,
    clockDy: options?.clockDy,
  };
}

function manualPosition(
  type: RicartEvent["type"],
  from: SiteId,
  to?: SiteId
) {
  if (type === "SEND_REQUEST" && from === 1 && to === 2) {
    return { x: 130, dx: 160, labelDy: -55, clockDy: 28 };
  }

  if (type === "SEND_REQUEST" && from === 1 && to === 3) {
    return { x: 130, dx: 120, labelDy: -35, clockDy: 28 };
  }

  if (type === "SEND_REQUEST" && from === 2 && to === 1) {
    return { x: 150, dx: 130, labelDy: -65, clockDy: 28 };
  }

  if (type === "SEND_REQUEST" && from === 2 && to === 3) {
    return { x: 150, dx: 350, labelDy: -35, clockDy: 28 };
  }

  if (type === "SEND_REPLY" && from === 3 && to === 1) {
    return { x: 320, dx: 214, labelDy: -60, clockDy: 28 };
  }

  if (type === "SEND_REPLY" && from === 3 && to === 2) {
    return { x: 550, dx: 110, labelDy: -55, clockDy: 28 };
  }

  if (type === "SEND_REPLY" && from === 2 && to === 1) {
    return { x: 330, dx: 120, labelDy: -50, clockDy: 28 };
  }

  if (type === "SEND_REPLY" && from === 1 && to === 2) {
    return { x: 720, dx: 120, labelDy: -55, clockDy: 28 };
  }

  if (type === "ENTER_CS" && from === 1) {
    return { x: 750 };
  }

  if (type === "EXIT_CS" && from === 1) {
    return { x: 850 };
  }

  if (type === "ENTER_CS" && from === 2) {
    return { x: 1120 };
  }

  if (type === "EXIT_CS" && from === 2) {
    return { x: 1090 };
  }

  return {};
}

function getRequestMessage(
  messages: RicartMessage[],
  from: SiteId,
  to: SiteId
): RicartMessage | undefined {
  return messages.find(
    (m) => m.type === "REQUEST" && m.from === from && m.to === to
  );
}

function getReplyMessage(
  messages: RicartMessage[],
  from: SiteId,
  to: SiteId
): RicartMessage | undefined {
  return messages.find(
    (m) => m.type === "REPLY" && m.from === from && m.to === to
  );
}

function removeMessage(
  messages: RicartMessage[],
  messageIdToRemove: number
): RicartMessage[] {
  return messages.filter((m) => m.id !== messageIdToRemove);
}

export function generateRicartAgrawalaSteps(): RicartStep[] {
  messageId = 1;
  eventId = 1;

  let currentStep = 0;
  let processes = initialProcesses();
  let messages: RicartMessage[] = [];
  let events: RicartEvent[] = [];
  let logs: string[] = ["Système initialisé."];

  let pendingReplies: Record<SiteId, SiteId[]> = {
    1: [],
    2: [],
    3: [],
  };

  let deferredReplies: Record<SiteId, SiteId[]> = {
    1: [],
    2: [],
    3: [],
  };

  const steps: RicartStep[] = [];

  function pushStep(title: string, description: string) {
    steps.push({
      id: currentStep,
      title,
      description,
      processes: cloneProcesses(processes),
      pendingReplies: cloneRecord(pendingReplies),
      deferredReplies: cloneRecord(deferredReplies),
      messages: [...messages],
      events: [...events],
      logs: [...logs],
    });
  }

  function requestCriticalSection(site: SiteId) {
    const p = getProcess(processes, site);

    incrementClock(p);
    p.status = "requesting";
    p.requestTimestamp = p.clock;

    pendingReplies[p.id] = otherSites(p.id);

    events.push(
      createEvent(
        currentStep,
        "REQUEST_CS",
        p.id,
        p.clock,
        `P${p.id} demande la section critique`
      )
    );

    for (const receiver of otherSites(p.id)) {
      messages.push(createMessage("REQUEST", p.id, receiver, p.clock));

      events.push(
        createEvent(
          currentStep,
          "SEND_REQUEST",
          p.id,
          p.clock,
          `REQUEST(${p.clock}, P${p.id})`,
          receiver,
          manualPosition("SEND_REQUEST", p.id, receiver)
        )
      );
    }

    logs.push(
      `P${p.id} diffuse REQUEST(${p.clock}, P${p.id}) à tous les autres processus.`
    );

    pushStep(
      `P${p.id} demande la section critique`,
      `P${p.id} incrémente son horloge et envoie REQUEST à tous les autres processus.`
    );
  }

  function deliverRequest(from: SiteId, to: SiteId) {
    const sender = getProcess(processes, from);
    const receiver = getProcess(processes, to);

    const requestMessage = getRequestMessage(messages, from, to);

    if (!requestMessage) return;

    const receiveClock = updateClockOnReceive(receiver, requestMessage.timestamp);

    events.push(
      createEvent(
        currentStep,
        "RECEIVE_REQUEST",
        from,
        requestMessage.timestamp,
        `P${to} reçoit REQUEST de P${from}`,
        to,
        {
          ...manualPosition("SEND_REQUEST", from, to),
          receiveTimestamp: receiveClock,
        }
      )
    );

    messages = removeMessage(messages, requestMessage.id);

    const requesterSnapshot: ProcessNode = {
      ...sender,
      requestTimestamp: requestMessage.timestamp,
    };

    if (receiver.status === "in_cs" || !hasPriority(requesterSnapshot, receiver)) {
      if (!deferredReplies[receiver.id].includes(sender.id)) {
        deferredReplies[receiver.id].push(sender.id);
      }

      logs.push(
        `P${receiver.id} reçoit REQUEST de P${sender.id}, met à jour son horloge logique et retarde sa réponse.`
      );

      pushStep(
        `P${receiver.id} reçoit REQUEST de P${sender.id}`,
        `P${receiver.id} met à jour son horloge logique mais retarde sa réponse à P${sender.id}.`
      );
    } else {
      incrementClock(receiver);

      messages.push(
        createMessage("REPLY", receiver.id, sender.id, receiver.clock)
      );

      logs.push(
        `P${receiver.id} reçoit REQUEST de P${sender.id}, met à jour son horloge logique et prépare REPLY.`
      );

      pushStep(
        `P${receiver.id} reçoit REQUEST de P${sender.id}`,
        `P${receiver.id} met à jour son horloge logique et prépare REPLY pour P${sender.id}.`
      );
    }
  }

  function deliverReply(from: SiteId, to: SiteId) {
    const receiver = getProcess(processes, to);

    const replyMessage = getReplyMessage(messages, from, to);

    if (!replyMessage) return;

    const receiveClock = updateClockOnReceive(receiver, replyMessage.timestamp);

    messages = removeMessage(messages, replyMessage.id);

    pendingReplies[receiver.id] = pendingReplies[receiver.id].filter(
      (p) => p !== from
    );

    events.push(
      createEvent(
        currentStep,
        "SEND_REPLY",
        from,
        replyMessage.timestamp,
        `REPLY(${replyMessage.timestamp}, P${from})`,
        to,
        {
          ...manualPosition("SEND_REPLY", from, to),
          receiveTimestamp: receiveClock,
        }
      )
    );

    logs.push(
      `P${to} reçoit REPLY de P${from}, met à jour son horloge logique et retire P${from} de la liste des réponses attendues.`
    );

    pushStep(
      `P${to} reçoit REPLY de P${from}`,
      `P${to} met à jour son horloge logique et retire P${from} de la liste des réponses attendues.`
    );
  }

  function tryEnterCriticalSection(site: SiteId) {
    const p = getProcess(processes, site);

    if (pendingReplies[p.id].length === 0 && p.status === "requesting") {
      incrementClock(p);
      p.status = "in_cs";

      events.push(
        createEvent(
          currentStep,
          "ENTER_CS",
          p.id,
          p.clock,
          `P${p.id} entre en SC`,
          undefined,
          manualPosition("ENTER_CS", p.id)
        )
      );

      logs.push(`P${p.id} a reçu tous les REPLY : il entre en section critique.`);

      pushStep(
        `P${p.id} entre en section critique`,
        `Toutes les autorisations ont été reçues.`
      );
    } else {
      logs.push(`P${p.id} ne peut pas encore entrer en SC.`);

      pushStep(
        `P${p.id} attend encore`,
        `Il manque encore des autorisations pour entrer en section critique.`
      );
    }
  }

  function exitCriticalSection(site: SiteId) {
    const p = getProcess(processes, site);

    // On ne ré-incrémente pas ici pour garder la sortie SC à H=6
    p.status = "released";
    p.requestTimestamp = undefined;

    events.push(
      createEvent(
        currentStep,
        "EXIT_CS",
        p.id,
        p.clock,
        `P${p.id} sort de la SC`,
        undefined,
        manualPosition("EXIT_CS", p.id)
      )
    );

    logs.push(`P${p.id} sort de la section critique.`);

    const delayed = [...deferredReplies[p.id]];
    deferredReplies[p.id] = [];

    for (const target of delayed) {
      messages.push(createMessage("REPLY", p.id, target, p.clock));

      events.push(
        createEvent(
          currentStep,
          "SEND_REPLY",
          p.id,
          p.clock,
          `REPLY différé de P${p.id} vers P${target}`,
          target,
          manualPosition("SEND_REPLY", p.id, target)
        )
      );

      logs.push(`P${p.id} envoie maintenant le REPLY différé à P${target}.`);
    }

    pushStep(
      `P${p.id} libère la section critique`,
      `P${p.id} sort de la SC et envoie les réponses qu’il avait retardées.`
    );
  }

  function apply(action: Action) {
    currentStep++;

    switch (action.kind) {
      case "REQUEST_CS":
        requestCriticalSection(action.site);
        break;

      case "DELIVER_REQUEST":
        deliverRequest(action.from, action.to);
        break;

      case "DELIVER_REPLY":
        deliverReply(action.from, action.to);
        break;

      case "TRY_ENTER_CS":
        tryEnterCriticalSection(action.site);
        break;

      case "EXIT_CS":
        exitCriticalSection(action.site);
        break;
    }
  }

  pushStep("État initial", "Tous les processus sont au repos.");

  const scenario: Action[] = [
  // P1 et P2 demandent la SC
  { kind: "REQUEST_CS", site: 1 },
  { kind: "REQUEST_CS", site: 2 },

  // REQUEST de P1
  { kind: "DELIVER_REQUEST", from: 1, to: 2 },
  { kind: "DELIVER_REQUEST", from: 1, to: 3 },

  // REQUEST de P2
  { kind: "DELIVER_REQUEST", from: 2, to: 1 },
  { kind: "DELIVER_REQUEST", from: 2, to: 3 },

  // P2 répond à P1
  { kind: "DELIVER_REPLY", from: 2, to: 1 },

  // P3 répond à P1
  { kind: "DELIVER_REPLY", from: 3, to: 1 },

  // P3 répond aussi à P2
  { kind: "DELIVER_REPLY", from: 3, to: 2 },

  // Maintenant P1 entre en SC
  { kind: "TRY_ENTER_CS", site: 1 },

  // P1 sort de SC
  { kind: "EXIT_CS", site: 1 },

  // P1 envoie le REPLY différé à P2
  { kind: "DELIVER_REPLY", from: 1, to: 2 },

  // P2 peut maintenant entrer
  { kind: "TRY_ENTER_CS", site: 2 },

  // P2 sort de SC
  { kind: "EXIT_CS", site: 2 },
];

  scenario.forEach(apply);

  return steps;
}

export const ricartAgrawalaSteps = generateRicartAgrawalaSteps();