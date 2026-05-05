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

  function apply(action: Action) {
    currentStep++;

    if (action.kind === "REQUEST_CS") {
      const p = getProcess(processes, action.site);

      p.clock++;
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

    if (action.kind === "DELIVER_REQUEST") {
      const sender = getProcess(processes, action.from);
      const receiver = getProcess(processes, action.to);

      const requestMessage = messages.find(
        (m) =>
          m.type === "REQUEST" &&
          m.from === action.from &&
          m.to === action.to
      );

      if (!requestMessage) return;

      receiver.clock = Math.max(receiver.clock, requestMessage.timestamp) + 1;
      const receiveClock = receiver.clock;

      events.push(
        createEvent(
          currentStep,
          "RECEIVE_REQUEST",
          action.from,
          requestMessage.timestamp,
          `P${action.to} reçoit REQUEST de P${action.from}`,
          action.to,
          {
            ...manualPosition("SEND_REQUEST", action.from, action.to),
            receiveTimestamp: receiveClock,
          }
        )
      );

      messages = messages.filter((m) => m.id !== requestMessage.id);

      const requesterSnapshot: ProcessNode = {
        ...sender,
        requestTimestamp: requestMessage.timestamp,
      };

      if (
        receiver.status === "in_cs" ||
        !hasPriority(requesterSnapshot, receiver)
      ) {
        deferredReplies[receiver.id].push(sender.id);

        logs.push(
          `P${receiver.id} retarde la réponse à P${sender.id}, car P${receiver.id} a la priorité ou est déjà en SC.`
        );

        pushStep(
          `P${receiver.id} retarde sa réponse`,
          `P${receiver.id} ne donne pas encore REPLY à P${sender.id}.`
        );
      } else {
        receiver.clock++;

        messages.push(
          createMessage("REPLY", receiver.id, sender.id, receiver.clock)
        );

        events.push(
          createEvent(
            currentStep,
            "SEND_REPLY",
            receiver.id,
            receiver.clock,
            `REPLY de P${receiver.id} vers P${sender.id}`,
            sender.id,
            // {
            //   ...manualPosition("SEND_REPLY", receiver.id, sender.id),
            //   // receiveTimestamp: Math.max(sender.clock, receiver.clock) + 1,
            // }

              manualPosition("SEND_REPLY", receiver.id, sender.id)
          )
        );

        logs.push(
          `P${receiver.id} envoie immédiatement REPLY à P${sender.id}.`
        );

        pushStep(
          `P${receiver.id} autorise P${sender.id}`,
          `P${receiver.id} envoie REPLY car il n’a pas une requête plus prioritaire.`
        );
      }
    }

    if (action.kind === "DELIVER_REPLY") {
      const receiver = getProcess(processes, action.to);

      const replyMessage = messages.find(
        (m) =>
          m.type === "REPLY" &&
          m.from === action.from &&
          m.to === action.to
      );

      if (!replyMessage) return;

      receiver.clock = Math.max(receiver.clock, replyMessage.timestamp) + 1;
      const receiveClock = receiver.clock;

      messages = messages.filter((m) => m.id !== replyMessage.id);

      pendingReplies[receiver.id] = pendingReplies[receiver.id].filter(
        (p) => p !== action.from
      );

      events.push(
        createEvent(
          currentStep,
          "RECEIVE_REPLY",
          action.from,
          replyMessage.timestamp,
          `P${action.to} reçoit REPLY de P${action.from}`,
          action.to,
          {
            ...manualPosition("SEND_REPLY", action.from, action.to),
            receiveTimestamp: receiveClock,
          }
        )
      );
      logs.push(
        `P${receiver.id} reçoit REPLY de P${action.from}. Réponses restantes : ${
          pendingReplies[receiver.id].join(", ") || "aucune"
        }.`
      );

      const hideThisStep =
        (action.to === 1 && action.from === 3) ||
        (action.to === 2 && action.from === 3);

      if (!hideThisStep) {
        pushStep(
          `P${receiver.id} reçoit une autorisation`,
          `P${receiver.id} met à jour son horloge de Lamport et retire P${action.from} de la liste d’attente.`
        );
      }
    }

    if (action.kind === "TRY_ENTER_CS") {
      const p = getProcess(processes, action.site);

      if (pendingReplies[p.id].length === 0 && p.status === "requesting") {
        p.clock++;
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

        logs.push(
          `P${p.id} a reçu tous les REPLY : il entre en section critique.`
        );

        pushStep(
          `P${p.id} entre en section critique`,
          `Toutes les autorisations ont été reçues.`
        );
      } else {
        logs.push(
          `P${p.id} ne peut pas encore entrer en SC : il attend encore des REPLY.`
        );

        pushStep(
          `P${p.id} attend encore`,
          `Il manque encore des autorisations pour entrer en section critique.`
        );
      }
    }

    if (action.kind === "EXIT_CS") {
      const p = getProcess(processes, action.site);

      p.clock++;
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
        p.clock++;

        messages.push(createMessage("REPLY", p.id, target, p.clock));

        events.push(
          createEvent(
            currentStep,
            "SEND_REPLY",
            p.id,
            p.clock,
            `REPLY différé de P${p.id} vers P${target}`,
            target,
            // {
            //   ...manualPosition("SEND_REPLY", p.id, target),
            //   receiveTimestamp: p.clock + 1,
            // }

            manualPosition("SEND_REPLY", p.id, target)
            
          )
        );

        logs.push(
          `P${p.id} envoie maintenant le REPLY différé à P${target}.`
        );
      }

      pushStep(
        `P${p.id} libère la section critique`,
        `P${p.id} sort de la SC et envoie les réponses qu’il avait retardées.`
      );
    }
  }

  pushStep("État initial", "Tous les processus sont au repos.");

const scenario: Action[] = [
  { kind: "REQUEST_CS", site: 1 },
  { kind: "REQUEST_CS", site: 2 },

  { kind: "DELIVER_REQUEST", from: 1, to: 2 },
  { kind: "DELIVER_REQUEST", from: 1, to: 3 },

  { kind: "DELIVER_REQUEST", from: 2, to: 1 },
  { kind: "DELIVER_REQUEST", from: 2, to: 3 },

  { kind: "DELIVER_REPLY", from: 2, to: 1 },
  { kind: "DELIVER_REPLY", from: 3, to: 1 },

  { kind: "TRY_ENTER_CS", site: 1 },
  { kind: "EXIT_CS", site: 1 },

  { kind: "DELIVER_REPLY", from: 3, to: 2 },
  { kind: "DELIVER_REPLY", from: 1, to: 2 },

  { kind: "TRY_ENTER_CS", site: 2 },
  { kind: "EXIT_CS", site: 2 },
];

  scenario.forEach(apply);

  return steps;
}