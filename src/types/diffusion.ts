// ─── Types partagés pour les algorithmes de diffusion ───────────────────────

export type AlgoId = 'fifo' | 'causal' | 'sequencer';

/** Un processus dans le système */
export interface Process {
  id: string;       // "P0", "P1", ...
  index: number;    // 0-based
}

/** Un message en transit ou livré */
export interface Message {
  id: string;
  from: number;     // index émetteur
  to: number;       // index récepteur (-1 = broadcast)
  content: string;
  /** Lamport / seq number (FIFO/Sequencer) */
  seqNum?: number;
  /** Vecteur d'horloge (causal) */
  vectorClock?: number[];
  /** Numéro d'ordre global assigné par le séquenceur */
  globalSeq?: number;
}

/** Un événement dans la simulation */
export type EventTag = 'send' | 'recv' | 'wait' | 'deliver' | 'order';

export interface SimStep {
  title: string;
  description: string;
  tag: EventTag;
  activeFrom?: number;
  activeTo?: number;
  /** Clocks visibles sur chaque nœud (peut être scalaire ou vecteur stringifié) */
  clocks: string[];
  /** Processus en attente (highlight) */
  waiting?: number[];
  /** Message affiché en transit sur le canvas */
  transitMsg?: Message;
  remarks: string[];
}

export interface AlgoDef {
  id: AlgoId;
  label: string;
  icon: string;
  pill: string;
  pillClass: string;
  description: string;
  steps: SimStep[];
}