import type { VectorStep, VectorValue } from '../../types/clock.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const N = 5; // nombre de processus

/** Clone une matrice de vecteurs */
const cloneAll = (m: VectorValue[]): VectorValue[] =>
  m.map(v => [...v] as VectorValue);

/**
 * Événement local sur le processus i :
 *   V[i][i] += 1
 */
function localEvent(clocks: VectorValue[], i: number): VectorValue[] {
  const next = cloneAll(clocks);
  next[i][i] += 1;
  return next;
}

/**
 * Envoi d'un message depuis le processus i :
 *   1. V[i][i] += 1  (incrément avant envoi)
 *   2. Retourne la copie du vecteur à envoyer (= V[i] après incrément)
 */
function sendEvent(
  clocks: VectorValue[],
  i: number,
): { clocks: VectorValue[]; sent: VectorValue } {
  const next = cloneAll(clocks);
  next[i][i] += 1;
  return { clocks: next, sent: [...next[i]] as VectorValue };
}

/**
 * Réception d'un message sur le processus j depuis processus i,
 * avec le vecteur expédié `sent` :
 *   1. Pour chaque k : V[j][k] = max(V[j][k], sent[k])
 *   2. V[j][j] += 1
 */
function recvEvent(
  clocks: VectorValue[],
  j: number,
  sent: VectorValue,
): VectorValue[] {
  const next = cloneAll(clocks);
  for (let k = 0; k < N; k++) {
    next[j][k] = Math.max(next[j][k], sent[k]);
  }
  next[j][j] += 1;
  return next;
}

/** Formate un vecteur pour l'affichage court dans le SVG */
export function fmtVector(v: VectorValue): string {
  return `[${v.join(',')}]`;
}

// ─── Scénario ─────────────────────────────────────────────────────────────────
/**
 * Scénario :
 *
 *   P1 ─── local ────────────────  V[P1] = [1,0,0,0,0]
 *   P1 ─── send ──▶ P2 ──────────  V[P1] = [2,0,0,0,0],  sent = [2,0,0,0,0]
 *   P2 ─── recv ◀── P1 ──────────  V[P2] = [2,1,0,0,0]   (max + P2++)
 *   P2 ─── local ────────────────  V[P2] = [2,2,0,0,0]
 *   P2 ─── send ──▶ P3 ──────────  V[P2] = [2,3,0,0,0],  sent = [2,3,0,0,0]
 *   P3 ─── recv ◀── P2 ──────────  V[P3] = [2,3,1,0,0]
 *   P1 ─── local ────────────────  V[P1] = [3,0,0,0,0]
 *   P1 ─── send ──▶ P4 ──────────  V[P1] = [4,0,0,0,0],  sent = [4,0,0,0,0]
 *   P4 ─── recv ◀── P1 ──────────  V[P4] = [4,0,0,1,0]
 *   P3 ─── send ──▶ P5 ──────────  V[P3] = [2,3,2,0,0],  sent = [2,3,2,0,0]
 *   P5 ─── recv ◀── P3 ──────────  V[P5] = [2,3,2,0,1]
 *   Causalité complète : P1 ─▶ P2 ─▶ P3 ─▶ P5  et  P1 ─▶ P4
 */
function buildVectorSteps(): VectorStep[] {
  const steps: VectorStep[] = [];

  // état initial : chaque processus a son propre vecteur zéro
  let c: VectorValue[] = Array.from({ length: N }, () =>
    [0, 0, 0, 0, 0] as VectorValue,
  );

  // Étape 1 — P1 local
  c = localEvent(c, 0);
  steps.push({
    t: `P1 exécute un événement local — V[P1] = ${fmtVector(c[0])}`,
    tag: 'local',
    clocks: cloneAll(c) as VectorValue[],
  });

  // Étape 2 — P1 → P2
  const s1 = sendEvent(c, 0);
  c = s1.clocks;
  steps.push({
    t: `P1 envoie à P2 son vecteur horloge ${fmtVector(s1.sent)}`,
    tag: 'send',
    from: 0,
    to: 1,
    clocks: cloneAll(c) as VectorValue[],
  });

  // Étape 3 — P2 reçoit de P1
  c = recvEvent(c, 1, s1.sent);
  steps.push({
    t: `P2 reçoit de P1 — fusion max + incrément → V[P2] = ${fmtVector(c[1])}`,
    tag: 'recv',
    from: 0,
    to: 1,
    clocks: cloneAll(c) as VectorValue[],
  });

  // Étape 4 — P2 local
  c = localEvent(c, 1);
  steps.push({
    t: `P2 exécute un événement local — V[P2] = ${fmtVector(c[1])}`,
    tag: 'local',
    clocks: cloneAll(c) as VectorValue[],
  });

  // Étape 5 — P2 → P3
  const s2 = sendEvent(c, 1);
  c = s2.clocks;
  steps.push({
    t: `P2 envoie à P3 son vecteur ${fmtVector(s2.sent)}`,
    tag: 'send',
    from: 1,
    to: 2,
    clocks: cloneAll(c) as VectorValue[],
  });

  // Étape 6 — P3 reçoit de P2
  c = recvEvent(c, 2, s2.sent);
  steps.push({
    t: `P3 reçoit de P2 — V[P3] = ${fmtVector(c[2])} — P3 connaît l'histoire de P1 et P2`,
    tag: 'recv',
    from: 1,
    to: 2,
    clocks: cloneAll(c) as VectorValue[],
  });

  // Étape 7 — P1 second local
  c = localEvent(c, 0);
  steps.push({
    t: `P1 exécute un deuxième événement local — V[P1] = ${fmtVector(c[0])}`,
    tag: 'local',
    clocks: cloneAll(c) as VectorValue[],
  });

  // Étape 8 — P1 → P4
  const s3 = sendEvent(c, 0);
  c = s3.clocks;
  steps.push({
    t: `P1 envoie à P4 son vecteur ${fmtVector(s3.sent)}`,
    tag: 'send',
    from: 0,
    to: 3,
    clocks: cloneAll(c) as VectorValue[],
  });

  // Étape 9 — P4 reçoit de P1
  c = recvEvent(c, 3, s3.sent);
  steps.push({
    t: `P4 reçoit de P1 — V[P4] = ${fmtVector(c[3])}`,
    tag: 'recv',
    from: 0,
    to: 3,
    clocks: cloneAll(c) as VectorValue[],
  });

  // Étape 10 — P3 → P5
  const s4 = sendEvent(c, 2);
  c = s4.clocks;
  steps.push({
    t: `P3 envoie à P5 son vecteur ${fmtVector(s4.sent)} (P3 connaît P1 et P2)`,
    tag: 'send',
    from: 2,
    to: 4,
    clocks: cloneAll(c) as VectorValue[],
  });

  // Étape 11 — P5 reçoit de P3
  c = recvEvent(c, 4, s4.sent);
  steps.push({
    t: `P5 reçoit de P3 — V[P5] = ${fmtVector(c[4])} — causalité complète P1→P2→P3→P5`,
    tag: 'recv',
    from: 2,
    to: 4,
    clocks: cloneAll(c) as VectorValue[],
  });

  return steps;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const VECTOR_STEPS: VectorStep[] = buildVectorSteps();

export const VECTOR_RULES = [
  'Événement local sur Pi :   V[i][i] += 1',
  'Envoi depuis Pi :          V[i][i] += 1  puis envoyer V[i]',
  'Réception sur Pj de V\' :  ∀k : V[j][k] = max(V[j][k], V\'[k])  puis V[j][j] += 1',
  'Pi < Pj  ssi  ∀k V[i][k] ≤ V[j][k]  et  ∃k V[i][k] < V[j][k]',
] as const;

export const VECTOR_PROPS = [
  { name: 'Ordre causal respecté',    status: 'ok'   as const, detail: '✓' },
  { name: 'Détection de concurrence', status: 'ok'   as const, detail: '✓' },
  { name: 'Comparaison possible',     status: 'ok'   as const, detail: '✓ (partielle)' },
  { name: 'Terminaison garantie',     status: 'ok'   as const, detail: '✓' },
  { name: 'Complexité message',       status: 'warn' as const, detail: 'O(N) par message' },
] as const;