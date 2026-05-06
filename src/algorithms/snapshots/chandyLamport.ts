import type {
  ChannelId,
  ChannelMessage,
  CutBoundary,
  DistributedTrace,
  MarkerTransmission,
  ProcessId,
  SimulationStep,
  SnapshotStep,
  SnapshotRun,
} from "../../types/snapshot.types";
import { buildGlobalStateFromCut } from "./globalState";
import { boundaryLabel, createCourseTrace, eventAtBoundary, parseChannelId } from "./cut";

export const PROCESS_IDS: ProcessId[] = ["P1", "P2", "P3"];
export const COLORS: Record<ProcessId, string> = {
  P1: "#2563eb",
  P2: "#059669",
  P3: "#7c3aed",
};

interface MarkerCandidate {
  from: ProcessId;
  to: ProcessId;
  channelId: ChannelId;
  sendTime: number;
  receiveTime: number;
  sendPosition: number;
  receivePosition: number;
}

export function runChandyLamport(
  trace: DistributedTrace,
  initiator: ProcessId,
  startBoundaryInput: number,
  snapshotId = "snapshot-cl"
): SnapshotRun {
  const startBoundary = clampBoundary(trace, initiator, startBoundaryInput);
  const recordTimes: Record<ProcessId, number> = {};
  const recordBoundary: CutBoundary = {};
  const markerArrivals: Record<ChannelId, MarkerCandidate> = {};
  const markerTransmissions: MarkerTransmission[] = [];
  const queue: MarkerCandidate[] = [];
  const log: string[] = [];

  for (const processId of trace.processes) {
    recordBoundary[processId] = -1;
  }

  const startTime = timeAfterBoundary(trace, initiator, startBoundary);
  recordTimes[initiator] = startTime;
  recordBoundary[initiator] = startBoundary;
  log.push(
    `${initiator} initie le snapshot apres ${boundaryLabel(trace, initiator, startBoundary)} et enregistre son etat local.`
  );
  enqueueOutgoingMarkers(trace, initiator, recordTimes, queue);

  while (queue.length > 0) {
    queue.sort((left, right) => left.receiveTime - right.receiveTime);
    const marker = queue.shift()!;
    if (markerArrivals[marker.channelId]) continue;
    markerArrivals[marker.channelId] = marker;

    const targetAlreadyRecorded = recordBoundary[marker.to] >= 0;
    if (!targetAlreadyRecorded) {
      const boundary = countEventsBefore(trace, marker.to, marker.receiveTime);
      recordTimes[marker.to] = marker.receiveTime;
      recordBoundary[marker.to] = boundary;
      log.push(
        `${marker.to} recoit son premier marqueur par ${marker.channelId}, enregistre ${boundaryLabel(
          trace,
          marker.to,
          boundary
        )}, puis propage les marqueurs.`
      );
      enqueueOutgoingMarkers(trace, marker.to, recordTimes, queue);
    } else {
      log.push(`${marker.to} recoit un marqueur suivant par ${marker.channelId} et ferme ce canal.`);
    }
  }

  const isComplete = trace.processes.every((processId) => recordBoundary[processId] >= 0);
  const safeBoundary = Object.fromEntries(
    trace.processes.map((processId) => [processId, Math.max(0, recordBoundary[processId])])
  ) as CutBoundary;
  const channelStates = computeRecordedChannels(trace, recordTimes, markerArrivals);
  const globalState = buildGlobalStateFromCut(trace, safeBoundary, { snapshotId, initiator });
  globalState.channelStates = channelStates;
  globalState.channelSum = Object.values(channelStates).reduce(
    (sum, messages) => sum + messages.reduce((inner, message) => inner + message.value, 0),
    0
  );
  globalState.total = globalState.processSum + globalState.channelSum;

  for (const [id, marker] of Object.entries(markerArrivals)) {
    const fromRecorded = countEventsBefore(trace, marker.from, marker.sendTime);
    const toRecorded = countEventsBefore(trace, marker.to, marker.receiveTime);
    const targetRecordTime = recordTimes[marker.to];
    markerTransmissions.push({
      id: `marker-${id}`,
      from: marker.from,
      to: marker.to,
      channelId: id,
      sendTime: marker.sendTime,
      receiveTime: marker.receiveTime,
      sendBoundary: fromRecorded,
      receiveBoundary: toRecorded,
      sendPosition: marker.sendPosition,
      receivePosition: marker.receivePosition,
      status: Math.abs(targetRecordTime - marker.receiveTime) < 0.0001 ? "first" : "closing",
      channelState: channelStates[id] ?? [],
    });
  }

  markerTransmissions.sort((left, right) => left.receiveTime - right.receiveTime);
  const steps = buildSnapshotSteps(trace, safeBoundary, markerTransmissions, channelStates, initiator, startBoundary);
  log.push(
    isComplete
      ? `Terminaison: chaque processus a enregistre son etat et chaque canal entrant a recu un marqueur.`
      : `Snapshot incomplet: certains processus ne sont pas atteints par les marqueurs.`
  );

  return {
    id: snapshotId,
    initiator,
    startBoundary,
    recordBoundary: safeBoundary,
    recordTimes,
    markerTransmissions,
    steps,
    processStates: globalState.processStates,
    channelStates,
    globalState,
    log,
    isComplete,
  };
}

export function generateChandyLamportSteps(): SimulationStep[] {
  const trace = createCourseTrace();
  const run = runChandyLamport(trace, "P1", 2);
  return run.log.map((description, index) => ({
    id: index,
    type: index === 0 ? "snapshot" : index === run.log.length - 1 ? "cut" : "marker_recv",
    description,
    processStates: [],
    channels: [],
    tag: "calcule",
    detail: description,
    globalState: index === run.log.length - 1 ? run.globalState : undefined,
  }));
}

function enqueueOutgoingMarkers(
  trace: DistributedTrace,
  from: ProcessId,
  recordTimes: Record<ProcessId, number>,
  queue: MarkerCandidate[]
): void {
  const sendTime = recordTimes[from];
  if (sendTime === undefined) return;

  for (const id of trace.channels) {
    const parsed = parseChannelId(id);
    if (parsed.from !== from) continue;
    const receiveTime = computeMarkerReceiveTime(trace, parsed.from, parsed.to, sendTime, id);
    const sendBoundary = countEventsBefore(trace, parsed.from, sendTime);
    const receiveBoundary = countEventsBefore(trace, parsed.to, receiveTime);
    queue.push({
      from: parsed.from,
      to: parsed.to,
      channelId: id,
      sendTime,
      receiveTime,
      sendPosition: markerPosition(trace, parsed.from, sendBoundary, `send:${id}:${sendTime}`),
      receivePosition: markerPosition(trace, parsed.to, receiveBoundary, `receive:${id}:${receiveTime}`),
    });
  }
}

function computeMarkerReceiveTime(
  trace: DistributedTrace,
  from: ProcessId,
  to: ProcessId,
  sendTime: number,
  id: ChannelId
): number {
  const beforeMarker = trace.messages.filter((message) => {
    return message.from === from && message.to === to && message.sentOrder < sendTime;
  });
  if (beforeMarker.some((message) => message.receivedOrder === undefined)) {
    return Number.POSITIVE_INFINITY;
  }
  const forcedByFifo = beforeMarker.reduce((max, message) => Math.max(max, (message.receivedOrder ?? 0) + 0.35), 0);
  const baseTravelTime = sendTime + channelDelay(id);
  return Math.max(baseTravelTime, forcedByFifo);
}

function channelDelay(channelId: ChannelId): number {
  const delays: Record<ChannelId, number> = {
    "P1->P2": 10.55,
    "P1->P3": 6.75,
    "P2->P1": 2.0,
    "P2->P3": 1.0,
    "P3->P1": 4.75,
    "P3->P2": 3.25,
  };
  return delays[channelId] ?? 3.2;
}

function buildSnapshotSteps(
  trace: DistributedTrace,
  finalBoundary: CutBoundary,
  markers: MarkerTransmission[],
  finalChannelStates: Record<ChannelId, ChannelMessage[]>,
  initiator: ProcessId,
  startBoundary: number
): SnapshotStep[] {
  const initialBoundary = emptyBoundary(trace.processes);
  initialBoundary[initiator] = startBoundary;
  const currentBoundary = { ...initialBoundary };
  const closedChannels: ChannelId[] = [];
  const channelStates = emptyChannelStates(trace.channels);
  const steps: SnapshotStep[] = [
    {
      id: 0,
      title: `Initialisation par ${initiator}`,
      detail: `${initiator} enregistre son etat local apres ${boundaryLabel(trace, initiator, startBoundary)} et envoie les premiers marqueurs.`,
      recordedBoundary: { ...currentBoundary },
      visibleMarkerIds: markers.filter((marker) => marker.from === initiator).map((marker) => marker.id),
      closedChannels: [],
      channelStates: cloneChannelStates(channelStates),
    },
  ];

  markers.forEach((marker, index) => {
    if (!closedChannels.includes(marker.channelId)) closedChannels.push(marker.channelId);
    channelStates[marker.channelId] = [...(finalChannelStates[marker.channelId] ?? [])];
    if (marker.status === "first") currentBoundary[marker.to] = marker.receiveBoundary;

    steps.push({
      id: index + 1,
      title:
        marker.status === "first"
          ? `${marker.to} recoit son premier marqueur`
          : `${marker.to} ferme le canal ${marker.channelId}`,
      detail:
        marker.status === "first"
          ? `${marker.channelId}: ${marker.to} enregistre son etat local, puis diffuse des marqueurs sur ses canaux sortants.`
          : `${marker.channelId}: le canal est cloture; son etat contient les messages arrives apres l'enregistrement local et avant ce marqueur.`,
      recordedBoundary: { ...currentBoundary },
      activeMarkerId: marker.id,
      visibleMarkerIds: markers.slice(0, index + 1).map((item) => item.id),
      closedChannels: [...closedChannels],
      channelStates: cloneChannelStates(channelStates),
    });
  });

  steps.push({
    id: markers.length + 1,
    title: "Terminaison",
    detail: "Tous les processus ont enregistre un etat local et tous les canaux entrants ont ete clotures par un marqueur.",
    recordedBoundary: { ...finalBoundary },
    visibleMarkerIds: markers.map((marker) => marker.id),
    closedChannels: [...trace.channels],
    channelStates: cloneChannelStates(finalChannelStates),
  });

  return steps;
}

function computeRecordedChannels(
  trace: DistributedTrace,
  recordTimes: Record<ProcessId, number>,
  markerArrivals: Record<ChannelId, MarkerCandidate>
): Record<ChannelId, ChannelMessage[]> {
  return Object.fromEntries(
    trace.channels.map((id) => {
      const { from, to } = parseChannelId(id);
      const senderRecord = recordTimes[from];
      const receiverRecord = recordTimes[to];
      const markerArrival = markerArrivals[id]?.receiveTime ?? Number.POSITIVE_INFINITY;
      const messages = trace.messages.filter((message) => {
        const receiveOrder = message.receivedOrder ?? Number.POSITIVE_INFINITY;
        return (
          message.from === from &&
          message.to === to &&
          senderRecord !== undefined &&
          receiverRecord !== undefined &&
          message.sentOrder < senderRecord &&
          receiveOrder > receiverRecord &&
          receiveOrder < markerArrival
        );
      });
      return [id, messages];
    })
  ) as Record<ChannelId, ChannelMessage[]>;
}

function emptyBoundary(processes: ProcessId[]): CutBoundary {
  return Object.fromEntries(processes.map((processId) => [processId, 0])) as CutBoundary;
}

function emptyChannelStates(channels: ChannelId[]): Record<ChannelId, ChannelMessage[]> {
  return Object.fromEntries(channels.map((id) => [id, [] as ChannelMessage[]])) as Record<ChannelId, ChannelMessage[]>;
}

function cloneChannelStates(states: Record<ChannelId, ChannelMessage[]>): Record<ChannelId, ChannelMessage[]> {
  return Object.fromEntries(
    Object.entries(states).map(([id, messages]) => [id, messages.map((message) => ({ ...message }))])
  ) as Record<ChannelId, ChannelMessage[]>;
}

function markerPosition(trace: DistributedTrace, processId: ProcessId, boundary: number, salt: string): number {
  const [direction, channelId] = salt.split(":");
  const positions: Record<ChannelId, { send: number; receive: number }> = {
    "P1->P2": { send: 4, receive: 11 },
    "P1->P3": { send: 4, receive: 6 },
    "P2->P1": { send: 10, receive: 12 },
    "P2->P3": { send: 10, receive: 12 },
    "P3->P1": { send: 6, receive: 8 },
    "P3->P2": { send: 6, receive: 10 },
  };
  const position = positions[channelId as ChannelId]?.[direction as "send" | "receive"];
  if (position !== undefined) {
    return position;
  }

  const max = trace.eventsByProcess[processId]?.length ?? 0;
  const fraction = 0.18 + pseudoRandom(salt) * 0.64;
  return Math.min(max + 0.82, Math.max(0.12, boundary + fraction));
}

function pseudoRandom(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function countEventsBefore(trace: DistributedTrace, processId: ProcessId, time: number): number {
  return trace.eventsByProcess[processId].filter((event) => event.order < time).length;
}

function timeAfterBoundary(trace: DistributedTrace, processId: ProcessId, boundary: number): number {
  const event = eventAtBoundary(trace, processId, boundary);
  if (!event) return 0.25;
  return event.order + 0.25;
}

function clampBoundary(trace: DistributedTrace, processId: ProcessId, boundary: number): number {
  const max = trace.eventsByProcess[processId]?.length ?? 0;
  return Math.max(0, Math.min(max, Math.trunc(boundary)));
}
