import type {
  Channel,
  ChannelId,
  ChannelMessage,
  Cut,
  CutBoundary,
  DistributedTrace,
  GlobalState,
  LocalState,
  ProcessId,
  ProcessState,
} from "../../types/snapshot.types";
import { createVector, evaluateCut, eventAtBoundary } from "./cut";

export function buildGlobalStateFromCut(
  trace: DistributedTrace,
  boundaryInput: Partial<CutBoundary>,
  options: { snapshotId?: string; initiator?: ProcessId } = {}
): GlobalState {
  const cut = evaluateCut(trace, boundaryInput, options.snapshotId ?? "manual-cut");
  const processStates = Object.fromEntries(
    trace.processes.map((processId) => {
      const boundary = cut.boundary[processId];
      const frontier = eventAtBoundary(trace, processId, boundary);
      const state: LocalState = {
        processId,
        eventIndex: boundary,
        eventId: frontier?.id,
        eventLabel: frontier?.label ?? "debut",
        value: frontier?.localValue ?? trace.initialValues[processId] ?? 0,
        vectorClock: frontier?.vectorClock ?? createVector(trace.processes),
      };
      return [processId, state];
    })
  ) as Record<ProcessId, LocalState>;
  const channelStates = cloneChannelStates(cut.channels);
  const processSum = Object.values(processStates).reduce((sum, state) => sum + state.value, 0);
  const channelSum = Object.values(channelStates).reduce(
    (sum, messages) => sum + messages.reduce((inner, message) => inner + message.value, 0),
    0
  );

  return {
    snapshotId: options.snapshotId ?? `global-${Date.now()}`,
    initiator: options.initiator,
    boundary: cut.boundary,
    processStates,
    channelStates,
    cut,
    isConsistent: cut.isConsistent,
    processSum,
    channelSum,
    total: processSum + channelSum,
    timestamp: Date.now(),
  };
}

export function formatGlobalState(globalState: GlobalState): string {
  const lines: string[] = [];
  lines.push(`Etat global ${globalState.snapshotId}`);
  if (globalState.initiator) lines.push(`Initiateur: ${globalState.initiator}`);
  lines.push(`Coherence: ${globalState.isConsistent ? "coherent" : "incoherent"}`);
  lines.push("");
  lines.push("Etats locaux:");

  for (const state of Object.values(globalState.processStates)) {
    lines.push(`- ${state.processId}: ${state.eventLabel ?? "debut"}`);
  }

  lines.push("");
  lines.push("Etats des canaux:");
  for (const [channel, messages] of Object.entries(globalState.channelStates)) {
    const content = messages.length ? messages.map((message) => message.label).join(", ") : "vide";
    lines.push(`- ${channel}: ${content}`);
  }

  return lines.join("\n");
}

export function computeGlobalSum(globalState: GlobalState): number {
  return globalState.total;
}

export function areGlobalStatesEquivalent(gs1: GlobalState, gs2: GlobalState): boolean {
  const ids1 = Object.keys(gs1.processStates).sort();
  const ids2 = Object.keys(gs2.processStates).sort();
  if (ids1.join(",") !== ids2.join(",")) return false;

  for (const processId of ids1) {
    if (gs1.processStates[processId].value !== gs2.processStates[processId].value) return false;
  }

  const channels1 = Object.keys(gs1.channelStates).sort();
  const channels2 = Object.keys(gs2.channelStates).sort();
  if (channels1.join(",") !== channels2.join(",")) return false;

  return channels1.every((channel) => {
    const left = gs1.channelStates[channel].map((message) => message.id).join(",");
    const right = gs2.channelStates[channel].map((message) => message.id).join(",");
    return left === right;
  });
}

/**
 * Compatibility helper for the first prototype.
 * Prefer buildGlobalStateFromCut(trace, boundary) in new code.
 */
export function buildGlobalState(
  snapshotId: string,
  initiator: ProcessId,
  processStates: ProcessState[],
  channels: Channel[]
): GlobalState {
  const processMap = Object.fromEntries(
    processStates.map((state) => {
      const local: LocalState = {
        processId: state.processId,
        eventIndex: state.snapshotClock ?? state.clock,
        value: state.snapshotValue ?? state.value,
        vectorClock: state.vectorClock ?? createVector(processStates.map((process) => process.processId)),
      };
      return [state.processId, local];
    })
  ) as Record<ProcessId, LocalState>;
  const channelStates = Object.fromEntries(
    channels.map((channel) => [channel.id, channel.recordedMessages.map((message) => ({ ...message }))])
  ) as Record<ChannelId, ChannelMessage[]>;
  const boundary = Object.fromEntries(
    processStates.map((state) => [state.processId, state.snapshotClock ?? state.clock])
  ) as CutBoundary;
  const processSum = Object.values(processMap).reduce((sum, state) => sum + state.value, 0);
  const channelSum = Object.values(channelStates).reduce(
    (sum, messages) => sum + messages.reduce((inner, message) => inner + message.value, 0),
    0
  );
  const cut: Cut = {
    id: snapshotId,
    boundary,
    states: boundary,
    frontierEvents: {},
    vectorDate: createVector(processStates.map((state) => state.processId)),
    channels: channelStates,
    ghostMessages: [],
    lostMessages: [],
    includedEventIds: new Set<string>(),
    vectorChecks: [],
    violations: [],
    isConsistent: true,
    reason: "Etat global construit depuis des etats deja enregistres.",
  };

  return {
    snapshotId,
    initiator,
    boundary,
    processStates: processMap,
    channelStates,
    cut,
    isConsistent: true,
    processSum,
    channelSum,
    total: processSum + channelSum,
    timestamp: Date.now(),
  };
}

function cloneChannelStates(states: Record<ChannelId, ChannelMessage[]>): Record<ChannelId, ChannelMessage[]> {
  return Object.fromEntries(
    Object.entries(states).map(([channel, messages]) => [channel, messages.map((message) => ({ ...message }))])
  ) as Record<ChannelId, ChannelMessage[]>;
}
