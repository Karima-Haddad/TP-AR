import type {
  ChannelId,
  ChannelMessage,
  Cut,
  CutBoundary,
  CutPreset,
  DistributedEvent,
  DistributedTrace,
  ProcessId,
  TraceDefinition,
  VectorClock,
} from "../../types/snapshot.types";

export function channelId(from: ProcessId, to: ProcessId): ChannelId {
  return `${from}->${to}`;
}

export function parseChannelId(id: ChannelId): { from: ProcessId; to: ProcessId } {
  const [from, to] = id.split("->");
  return { from, to };
}

export function createVector(processes: ProcessId[], value = 0): VectorClock {
  return Object.fromEntries(processes.map((id) => [id, value])) as VectorClock;
}

export function cloneVector(vector: VectorClock): VectorClock {
  return { ...vector };
}

export function maxVector(processes: ProcessId[], ...vectors: VectorClock[]): VectorClock {
  const result = createVector(processes);
  for (const processId of processes) {
    result[processId] = Math.max(...vectors.map((vector) => vector[processId] ?? 0));
  }
  return result;
}

export function formatVector(processes: ProcessId[], vector: VectorClock): string {
  return `(${processes.map((id) => vector[id] ?? 0).join(",")})`;
}

export function eventAtBoundary(
  trace: DistributedTrace,
  processId: ProcessId,
  boundary: number
): DistributedEvent | undefined {
  if (boundary <= 0) return undefined;
  return trace.eventsByProcess[processId]?.[boundary - 1];
}

export function normaliseBoundary(
  trace: DistributedTrace,
  boundary: Partial<CutBoundary>
): CutBoundary {
  return Object.fromEntries(
    trace.processes.map((processId) => {
      const max = trace.eventsByProcess[processId]?.length ?? 0;
      const value = Math.trunc(boundary[processId] ?? 0);
      return [processId, Math.min(max, Math.max(0, value))];
    })
  ) as CutBoundary;
}

export function boundaryLabel(trace: DistributedTrace, processId: ProcessId, boundary: number): string {
  const event = eventAtBoundary(trace, processId, boundary);
  return event ? event.label : "debut";
}

export function buildDistributedTrace(definition: TraceDefinition): DistributedTrace {
  const processes = [...definition.processes];
  const counters = createVector(processes);
  const values = { ...definition.initialValues };
  const vectors = Object.fromEntries(
    processes.map((processId) => [processId, createVector(processes)])
  ) as Record<ProcessId, VectorClock>;
  const eventsByProcess = Object.fromEntries(
    processes.map((processId) => [processId, [] as DistributedEvent[]])
  ) as Record<ProcessId, DistributedEvent[]>;
  const events: DistributedEvent[] = [];
  const messages: ChannelMessage[] = [];
  const messagesById: Record<string, ChannelMessage> = {};

  for (const draft of definition.events) {
    const processId = draft.processId;
    if (!processes.includes(processId)) {
      throw new Error(`Processus inconnu: ${processId}`);
    }

    const processIndex = (counters[processId] ?? 0) + 1;
    const order = events.length + 1;
    const label = draft.label ?? makeEventLabel(processes, processId, processIndex);
    const id = label;
    let vector = cloneVector(vectors[processId]);
    let localValue = values[processId] ?? 0;
    let peer: ProcessId | undefined;
    let channel: ChannelId | undefined;
    let value: number | undefined;
    let messageId = draft.messageId;

    if (draft.kind === "send") {
      if (!draft.to) {
        throw new Error(`Evenement ${label}: un envoi doit definir "to".`);
      }
      peer = draft.to;
      channel = channelId(processId, draft.to);
      value = draft.value ?? 0;
      messageId = draft.messageId ?? `m${messages.length + 1}`;
      vector[processId] = processIndex;
      localValue += draft.valueDelta ?? -value;
    }

    if (draft.kind === "receive") {
      if (!draft.messageId || !messagesById[draft.messageId]) {
        throw new Error(`Evenement ${label}: message a recevoir introuvable.`);
      }
      const message = messagesById[draft.messageId];
      peer = message.from;
      channel = channelId(message.from, processId);
      value = message.value;
      messageId = message.id;
      vector = maxVector(processes, vector, message.sendVector);
      vector[processId] = processIndex;
      localValue += draft.valueDelta ?? message.value;
    }

    if (draft.kind === "internal") {
      vector[processId] = processIndex;
      localValue += draft.valueDelta ?? 0;
    }

    const event: DistributedEvent = {
      id,
      label,
      order,
      processId,
      processIndex,
      kind: draft.kind,
      vectorClock: cloneVector(vector),
      localValue,
      description: draft.description ?? defaultEventDescription(draft.kind, processId, peer),
      messageId,
      peer,
      channelId: channel,
      value,
    };

    if (draft.kind === "send" && peer && channel && messageId) {
      const message: ChannelMessage = {
        id: messageId,
        label: messageId,
        from: processId,
        to: peer,
        value: value ?? 0,
        sentAt: processIndex,
        sentOrder: order,
        sendEventId: id,
        sendVector: cloneVector(vector),
      };
      messagesById[message.id] = message;
      messages.push(message);
    }

    if (draft.kind === "receive" && messageId) {
      const message = messagesById[messageId];
      message.receivedAt = processIndex;
      message.receivedOrder = order;
      message.receiveEventId = id;
      message.receiveVector = cloneVector(vector);
    }

    counters[processId] = processIndex;
    values[processId] = localValue;
    vectors[processId] = cloneVector(vector);
    events.push(event);
    eventsByProcess[processId].push(event);
  }

  const completeChannels = processes.flatMap((from) =>
    processes.filter((to) => to !== from).map((to) => channelId(from, to))
  );
  const channels = Array.from(
    new Set([...(definition.channels ?? completeChannels), ...messages.map((message) => channelId(message.from, message.to))])
  );
  const totalInitialValue = processes.reduce((sum, processId) => sum + (definition.initialValues[processId] ?? 0), 0);

  return {
    processes,
    initialValues: { ...definition.initialValues },
    totalInitialValue,
    channels,
    events,
    eventsByProcess,
    messages,
  };
}

export const COURSE_TRACE_DEFINITION: TraceDefinition = {
  processes: ["P1", "P2", "P3"],
  initialValues: { P1: 100, P2: 80, P3: 60 },
  events: [
    { processId: "P1", kind: "internal", label: "e11", description: "P1 execute un evenement interne." },
    { processId: "P1", kind: "send", label: "e12", messageId: "m2", to: "P2", description: "P1 emet m2 vers P2." },
    { processId: "P1", kind: "internal", label: "e13", description: "P1 execute un evenement interne." },
    { processId: "P3", kind: "send", label: "e31", messageId: "m1", to: "P2", description: "P3 emet m1 vers P2." },
    { processId: "P2", kind: "internal", label: "e21", description: "P2 execute un evenement interne." },
    { processId: "P2", kind: "receive", label: "e22", messageId: "m1", description: "P2 recoit m1." },
    { processId: "P2", kind: "receive", label: "e23", messageId: "m2", description: "P2 recoit m2." },
    { processId: "P3", kind: "internal", label: "e32", description: "P3 execute un evenement interne." },
    { processId: "P2", kind: "send", label: "e24", messageId: "m3", to: "P3", description: "P2 emet m3 vers P3." },
    { processId: "P3", kind: "receive", label: "e33", messageId: "m3", description: "P3 recoit m3." },
    { processId: "P2", kind: "send", label: "e25", messageId: "m4", to: "P1", description: "P2 emet m4 vers P1." },
    { processId: "P1", kind: "receive", label: "e14", messageId: "m4", description: "P1 recoit m4." },
    { processId: "P2", kind: "send", label: "e26", messageId: "m5", to: "P3", description: "P2 emet m5 vers P3." },
    { processId: "P3", kind: "receive", label: "e34", messageId: "m5", description: "P3 recoit m5." },
    { processId: "P1", kind: "internal", label: "e15", description: "P1 execute un evenement interne." },
  ],
};

export function createCourseTrace(): DistributedTrace {
  return buildDistributedTrace(COURSE_TRACE_DEFINITION);
}

export function evaluateCut(
  trace: DistributedTrace,
  boundaryInput: Partial<CutBoundary>,
  id = "cut"
): Cut {
  const boundary = normaliseBoundary(trace, boundaryInput);
  const frontierEvents = Object.fromEntries(
    trace.processes.map((processId) => [processId, eventAtBoundary(trace, processId, boundary[processId])])
  ) as Record<ProcessId, DistributedEvent | undefined>;
  const includedEventIds = new Set(
    trace.events
      .filter((event) => event.processIndex <= boundary[event.processId])
      .map((event) => event.id)
  );
  const channels = Object.fromEntries(trace.channels.map((channel) => [channel, [] as ChannelMessage[]])) as Record<
    ChannelId,
    ChannelMessage[]
  >;
  const ghostMessages: ChannelMessage[] = [];

  for (const message of trace.messages) {
    const sendInCut = message.sentAt <= boundary[message.from];
    const receiveInCut = message.receivedAt !== undefined && message.receivedAt <= boundary[message.to];
    const key = channelId(message.from, message.to);

    if (sendInCut && !receiveInCut) {
      channels[key] = channels[key] ?? [];
      channels[key].push(message);
    }

    if (receiveInCut && !sendInCut) {
      ghostMessages.push(message);
    }
  }

  const frontierVectors = trace.processes
    .map((processId) => frontierEvents[processId]?.vectorClock)
    .filter((vector): vector is VectorClock => Boolean(vector));
  const vectorDate = frontierVectors.length
    ? maxVector(trace.processes, ...frontierVectors)
    : createVector(trace.processes);
  const vectorChecks = trace.processes.map((processId) => {
    const component = vectorDate[processId] ?? 0;
    const frontier = frontierEvents[processId];
    return {
      processId,
      boundary: boundary[processId],
      vectorComponent: component,
      frontierLabel: frontier?.label ?? "debut",
      ok: component === boundary[processId],
    };
  });

  const vectorViolations = vectorChecks
    .filter((check) => !check.ok)
    .map((check) => ({
      type: "vector-clock" as const,
      processId: check.processId,
      description: `V(C)[${check.processId}]=${check.vectorComponent} depasse la frontiere locale ${check.boundary} (${check.frontierLabel}).`,
    }));

  const ghostViolations = ghostMessages.map((message) => ({
    type: "ghost-message" as const,
    messageId: message.id,
    messageLabel: message.label,
    description: `${message.label} est recu par ${message.to} dans la coupure, mais son emission par ${message.from} est hors coupure.`,
  }));
  const violations = [...ghostViolations, ...vectorViolations];
  const isConsistent = violations.length === 0;

  return {
    id,
    boundary,
    states: boundary,
    frontierEvents,
    vectorDate,
    channels,
    ghostMessages,
    lostMessages: [],
    includedEventIds,
    vectorChecks,
    violations,
    isConsistent,
    reason: isConsistent
      ? "Coupure coherente: chaque reception incluse possede son emission dans le passe causal."
      : violations[0]?.description ?? "Coupure incoherente.",
  };
}

export function checkConsistency(
  clocks: Record<ProcessId, number>,
  messages: ChannelMessage[]
): boolean {
  for (const message of messages) {
    if (message.isMarker) continue;
    const receiverClock = clocks[message.to] ?? 0;
    const senderClock = clocks[message.from] ?? 0;
    const receptionInCut = message.receivedAt !== undefined && message.receivedAt <= receiverClock;
    const sendInCut = message.sentAt <= senderClock;
    if (receptionInCut && !sendInCut) return false;
  }
  return true;
}

export function generateArbitraryCut(
  clocks: Record<ProcessId, number>,
  messages: ChannelMessage[]
): Cut {
  const processes = Object.keys(clocks);
  const channels = Object.fromEntries(
    Array.from(new Set(messages.map((message) => channelId(message.from, message.to)))).map((id) => [id, [] as ChannelMessage[]])
  ) as Record<ChannelId, ChannelMessage[]>;
  const ghostMessages: ChannelMessage[] = [];

  for (const message of messages) {
    if (message.isMarker) continue;
    const sendInCut = message.sentAt <= (clocks[message.from] ?? 0);
    const receiveInCut = message.receivedAt !== undefined && message.receivedAt <= (clocks[message.to] ?? 0);
    const key = channelId(message.from, message.to);
    if (sendInCut && !receiveInCut) {
      channels[key] = channels[key] ?? [];
      channels[key].push(message);
    }
    if (receiveInCut && !sendInCut) ghostMessages.push(message);
  }

  const isConsistent = ghostMessages.length === 0;
  const vectorDate = createVector(processes);
  return {
    id: `cut-${Date.now()}`,
    boundary: { ...clocks },
    states: { ...clocks },
    frontierEvents: {},
    vectorDate,
    channels,
    ghostMessages,
    lostMessages: [],
    includedEventIds: new Set<string>(),
    vectorChecks: [],
    violations: ghostMessages.map((message) => ({
      type: "ghost-message" as const,
      messageId: message.id,
      messageLabel: message.label,
      description: `${message.label} est recu sans emission incluse.`,
    })),
    isConsistent,
    reason: isConsistent
      ? "Aucun message recu sans avoir ete envoye dans la coupure."
      : "Au moins un message est recu avant d'etre envoye dans la coupure.",
  };
}

export function getCourseCutPresets(trace: DistributedTrace): CutPreset[] {
  const preset = (id: string, label: string, boundary: Partial<CutBoundary>, description: string): CutPreset => ({
    id,
    label,
    boundary: normaliseBoundary(trace, boundary),
    description,
  });

  return [
    preset("c1", "C1 coherente", { P1: 3, P2: 2, P3: 3 }, "Frontieres e13, e22 et e33. Les messages m3 et m4 sont en transit."),
    preset("cp", "C' incoherente", { P1: 1, P2: 3, P3: 5 }, "P3 a deja recu m3, mais P1 n'a pas encore inclus son emission e12."),
    preset("c2", "C2 complete", { P1: 5, P2: 4, P3: 5 }, "Toute l'histoire locale connue est incluse."),
  ];
}

export function generateExampleCuts(messages: ChannelMessage[]): Cut[] {
  return [
    generateArbitraryCut({ P1: 0, P2: 0, P3: 0 }, messages),
    generateArbitraryCut({ P1: 1, P2: 3, P3: 5 }, messages),
    generateArbitraryCut({ P1: 5, P2: 4, P3: 5 }, messages),
  ];
}

function makeEventLabel(processes: ProcessId[], processId: ProcessId, index: number): string {
  const suffix = processId.match(/\d+$/)?.[0] ?? String(processes.indexOf(processId) + 1);
  return `e${suffix}${index}`;
}

function defaultEventDescription(
  kind: "internal" | "send" | "receive",
  processId: ProcessId,
  peer?: ProcessId
): string {
  if (kind === "send") return `${processId} emet un message vers ${peer}.`;
  if (kind === "receive") return `${processId} recoit un message de ${peer}.`;
  return `${processId} execute un evenement interne.`;
}
