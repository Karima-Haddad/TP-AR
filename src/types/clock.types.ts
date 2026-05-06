// ─── Types de base ────────────────────────────────────────────────────────────

export type StepTag = 'local' | 'send' | 'recv';

export interface Process {
  id: string;   // 'P1' .. 'P5'
  x: number;
  y: number;
}

// ─── Horloge de Lamport ───────────────────────────────────────────────────────

/** Une valeur entière par processus */
export type LamportClocks = [number, number, number, number, number];

export interface LamportStep {
  /** Description textuelle affichée dans le panneau Étapes */
  t: string;
  tag: StepTag;
  /** Index du processus émetteur (si tag === 'send') */
  from?: number;
  /** Index du processus destinataire (si tag === 'send' | 'recv') */
  to?: number;
  /** État de toutes les horloges après cet événement */
  clocks: LamportClocks;
}

// ─── Horloge vectorielle ──────────────────────────────────────────────────────

/** Un vecteur de 5 entiers — un par processus */
export type VectorValue = [number, number, number, number, number];

export interface VectorStep {
  t: string;
  tag: StepTag;
  from?: number;
  to?: number;
  /**
   * Vecteur de chaque processus à cet instant.
   * Affiché sous les nœuds SVG et dans les clock-cards.
   * Pour le SVG on formattera chaque vecteur en chaîne courte,
   * ex: "[1,2,0]" tronqué si besoin.
   */
  clocks: VectorValue[];   // longueur 5 — un vecteur par processus
}

// ─── Horloge matricielle ──────────────────────────────────────────────────────

/** Matrice 5×5 — M[i][j] = ce que Pi sait de l'horloge de Pj */
export type MatrixValue = VectorValue[];   // 5 lignes × 5 colonnes

export interface MatrixStep {
  t: string;
  tag: StepTag;
  from?: number;
  to?: number;
  /**
   * Matrice de chaque processus.
   * Pour l'affichage SVG on extrait la diagonale M[i][i].
   */
  matrices: MatrixValue[];  // longueur 5
}

// ─── Union pratique pour le composant ─────────────────────────────────────────

export type ClockAlgo = 'lamport' | 'vector' | 'matrix';

export type AnyStep = LamportStep | VectorStep | MatrixStep;