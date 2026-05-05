export type ProcessStatus =
  | "idle"
  | "requesting"
  | "in_cs"
  | "released";

export type MessageType =
  | "REQ"
  | "ACQ"
  | "REL";

export interface ProcessNode {
  id: number;
  name: string;
  clock: number;
  status: ProcessStatus;
}

export interface LamportMessage {
  type: MessageType;
  from: number;
  to: number;
  timestamp: number;
}

/*
Fa[i] : file locale de chaque processus
triée par estampilles Lamport
*/
export interface QueueEntry {
  type: MessageType;
  timestamp: number;
  processId: number;
}

/*
Messages / événements à dessiner
sur la timeline SVG
*/
export interface LamportEvent {
  id: number;
  type: MessageType | "ENTER_CS" | "EXIT_CS";
  from?: number;
  to?: number;

  timestamp?: number;
  receiveTimestamp?: number;

  sendClock?: number;
  receiveClock?: number;

  label: string;
  step: number;

  x?: number;
  dx?: number;
  labelDy?: number;
  clockDy?: number;
}

export interface LamportState {
  processes: ProcessNode[];

  queues: Record<number, QueueEntry[]>;

  /*
  messages "en transit"
  pour animation si besoin
  */
  messages: LamportMessage[];

  currentStep: number;

  logs: string[];
}

/*
Une étape complète de simulation
(pour suivant / précédent)
*/
export interface LamportStep {
  title: string;
  description: string;

  state: LamportState;

  /*
  flèches + entrées/sorties SC
  à visualiser
  */
  events: LamportEvent[];
}


