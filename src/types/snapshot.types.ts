export type ProcessId = string;
export type ChannelId = string;

export type EventKind = "internal" | "send" | "receive";
export type MarkerStatus = "pending" | "first" | "closing";

export type VectorClock = Record<ProcessId, number>;
export type CutBoundary = Record<ProcessId, number>;

export interface TraceEventDraft {
  processId: ProcessId;
  kind: EventKind;
  label?: string;
  description?: string;
  messageId?: string;
  to?: ProcessId;
  value?: number;
  valueDelta?: number;
}

export interface TraceDefinition {
  processes: ProcessId[];
  initialValues: Record<ProcessId, number>;
  channels?: ChannelId[];
  events: TraceEventDraft[];
}

export interface DistributedEvent {
  id: string;
  label: string;
  order: number;
  processId: ProcessId;
  processIndex: number;
  kind: EventKind;
  vectorClock: VectorClock;
  localValue: number;
  description: string;
  messageId?: string;
  peer?: ProcessId;
  channelId?: ChannelId;
  value?: number;
}

export interface ChannelMessage {
  id: string;
  label: string;
  from: ProcessId;
  to: ProcessId;
  value: number;
  sentAt: number;
  sentOrder: number;
  sendEventId: string;
  sendVector: VectorClock;
  receivedAt?: number;
  receivedOrder?: number;
  receiveEventId?: string;
  receiveVector?: VectorClock;
  isMarker?: boolean;
}

export interface DistributedTrace {
  processes: ProcessId[];
  initialValues: Record<ProcessId, number>;
  totalInitialValue: number;
  channels: ChannelId[];
  events: DistributedEvent[];
  eventsByProcess: Record<ProcessId, DistributedEvent[]>;
  messages: ChannelMessage[];
}

export interface LocalState {
  processId: ProcessId;
  eventIndex: number;
  eventId?: string;
  eventLabel?: string;
  value: number;
  vectorClock: VectorClock;
}

export interface CutViolation {
  type: "ghost-message" | "vector-clock";
  processId?: ProcessId;
  messageId?: string;
  messageLabel?: string;
  description: string;
}

export interface VectorCutCheck {
  processId: ProcessId;
  boundary: number;
  vectorComponent: number;
  frontierLabel: string;
  ok: boolean;
}

export interface Cut {
  id: string;
  boundary: CutBoundary;
  states: CutBoundary;
  frontierEvents: Record<ProcessId, DistributedEvent | undefined>;
  vectorDate: VectorClock;
  channels: Record<ChannelId, ChannelMessage[]>;
  ghostMessages: ChannelMessage[];
  lostMessages: ChannelMessage[];
  includedEventIds: Set<string>;
  vectorChecks: VectorCutCheck[];
  violations: CutViolation[];
  isConsistent: boolean;
  reason: string;
}

export interface GlobalState {
  snapshotId: string;
  initiator?: ProcessId;
  boundary: CutBoundary;
  processStates: Record<ProcessId, LocalState>;
  channelStates: Record<ChannelId, ChannelMessage[]>;
  cut: Cut;
  isConsistent: boolean;
  processSum: number;
  channelSum: number;
  total: number;
  timestamp: number;
}

export interface MarkerTransmission {
  id: string;
  from: ProcessId;
  to: ProcessId;
  channelId: ChannelId;
  sendTime: number;
  receiveTime: number;
  sendBoundary: number;
  receiveBoundary: number;
  sendPosition: number;
  receivePosition: number;
  status: MarkerStatus;
  channelState: ChannelMessage[];
}

export interface SnapshotStep {
  id: number;
  title: string;
  detail: string;
  recordedBoundary: CutBoundary;
  activeMarkerId?: string;
  visibleMarkerIds: string[];
  closedChannels: ChannelId[];
  channelStates: Record<ChannelId, ChannelMessage[]>;
}

export interface SnapshotRun {
  id: string;
  initiator: ProcessId;
  startBoundary: number;
  recordBoundary: CutBoundary;
  recordTimes: Record<ProcessId, number>;
  markerTransmissions: MarkerTransmission[];
  steps: SnapshotStep[];
  processStates: Record<ProcessId, LocalState>;
  channelStates: Record<ChannelId, ChannelMessage[]>;
  globalState: GlobalState;
  log: string[];
  isComplete: boolean;
}

export interface CutPreset {
  id: string;
  label: string;
  boundary: CutBoundary;
  description: string;
}

/**
 * Legacy shapes kept so older imports in course prototypes still type-check.
 * The new UI uses DistributedTrace, Cut and SnapshotRun above.
 */
export interface ProcessState {
  processId: ProcessId;
  clock: number;
  value: number;
  hasRecordedSnapshot: boolean;
  snapshotClock?: number;
  snapshotValue?: number;
  vectorClock?: VectorClock;
}

export interface Channel {
  id: ChannelId;
  from: ProcessId;
  to: ProcessId;
  messages: ChannelMessage[];
  recordedMessages: ChannelMessage[];
  isRecording: boolean;
}

export interface SimulationStep {
  id: number;
  type:
    | "local"
    | "send"
    | "recv"
    | "marker_send"
    | "marker_recv"
    | "snapshot"
    | "cut";
  description: string;
  processStates: ProcessState[];
  channels: Channel[];
  activeProcess?: ProcessId;
  activeChannel?: ChannelId;
  highlightedCut?: number[];
  globalState?: GlobalState;
  tag: string;
  detail?: string;
}
