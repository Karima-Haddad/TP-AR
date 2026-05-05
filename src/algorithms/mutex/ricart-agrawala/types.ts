export type SiteId = 1 | 2 | 3;

export type ProcessStatus =
  | "idle"
  | "requesting"
  | "in_cs"
  | "released";

export type MessageType = "REQUEST" | "REPLY";

export interface ProcessNode {
  id: SiteId;
  name: string;
  clock: number;
  status: ProcessStatus;
  requestTimestamp?: number;
}

export interface RicartMessage {
  id: number;
  type: MessageType;
  from: SiteId;
  to: SiteId;
  timestamp: number;
}

export interface RicartEvent {
  id: number;
  step: number;

  type:
    | "REQUEST_CS"
    | "SEND_REQUEST"
    | "RECEIVE_REQUEST"
    | "SEND_REPLY"
    | "RECEIVE_REPLY"
    | "ENTER_CS"
    | "EXIT_CS";

  from: SiteId;
  to?: SiteId;

  timestamp: number;
  receiveTimestamp?: number;

  label: string;

  x?: number;
  dx?: number;
  labelDy?: number;
  clockDy?: number;
}

export interface RicartStep {
  id: number;
  title: string;
  description: string;

  processes: ProcessNode[];

  pendingReplies: Record<SiteId, SiteId[]>;

  deferredReplies: Record<SiteId, SiteId[]>;

  messages: RicartMessage[];

  events: RicartEvent[];

  logs: string[];
}

