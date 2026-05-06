import type { MatrixStep, MatrixValue, VectorValue } from '../../types/clock.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const N = 5;

const zeroMatrix = (): MatrixValue =>
  Array.from({ length: N }, () => [0, 0, 0, 0, 0] as VectorValue);

const cloneAll = (mats: MatrixValue[]): MatrixValue[] =>
  mats.map(m => m.map(row => [...row] as VectorValue) as MatrixValue);

/**
 * Événement local sur Pi :
 *   HM[i][i][i] += 1
 */
function localEvent(mats: MatrixValue[], i: number): MatrixValue[] {
  const next = cloneAll(mats);
  next[i][i][i] += 1;
  return next;
}

/**
 * Envoi d'un message de Pi vers Pj :
 *   HM[i][i][i] += 1   (événement local)
 *   HM[i][i][j] += 1   (message émis vers Pj)
 *   Estampille EMm = HM[i] (matrice entière)
 */
function sendEvent(
  mats: MatrixValue[],
  i: number,
  j: number,
): { mats: MatrixValue[]; sent: MatrixValue } {
  const next = cloneAll(mats);
  next[i][i][i] += 1;   // événement local
  next[i][i][j] += 1;   // message émis vers Pj
  const sent: MatrixValue = next[i].map(row => [...row] as VectorValue) as MatrixValue;
  return { mats: next, sent };
}

/**
 * Réception sur Pi d'un message de Pj portant l'estampille EMm :
 *   1. HM[i][i][i] += 1
 *        (réception = événement local, seule la diagonale est incrémentée)
 *   2. ∀(k,l) ≠ (i,i) :
 *        HM[i][k][l] = max(HM[i][k][l], EMm[k][l])
 *        (fusion de toutes les autres cases, y compris HM[i][i][j]
 *         dont la valeur correcte est déjà portée par EMm)
 *
 * Condition de délivrance (vérifiée avant d'appeler cette fonction) :
 *   FIFO      : EMm[j][i] = HM[i][j][i] + 1
 *   Précédence: ∀k≠i : EMm[k][i] ≤ HM[i][k][i]
 */
function recvEvent(
  mats: MatrixValue[],
  i: number,        // récepteur
  _j: number,       // émetteur (non utilisé directement : info portée par EMm)
  received: MatrixValue,
): MatrixValue[] {
  const next = cloneAll(mats);

  // Étape 1 — seul l'événement local incrémente la diagonale
  next[i][i][i] += 1;

  // Étape 2 — fusion de toutes les cases sauf [i][i]
  for (let k = 0; k < N; k++) {
    for (let l = 0; l < N; l++) {
      if (k === i && l === i) continue; // déjà traité ci-dessus
      next[i][k][l] = Math.max(next[i][k][l], received[k][l]);
    }
  }

  return next;
}

/**
 * Extrait la diagonale de HM[i] : [HM[i][0][0], ..., HM[i][4][4]]
 * = nombre d'événements locaux de chaque Pk dont Pi a connaissance.
 */
export function diagonal(mat: MatrixValue): VectorValue {
  return [mat[0][0], mat[1][1], mat[2][2], mat[3][3], mat[4][4]] as VectorValue;
}

export function fmtDiagonal(mat: MatrixValue): string {
  return `[${diagonal(mat).join(',')}]`;
}

// ─── Condition de délivrance ──────────────────────────────────────────────────

/**
 * Vérifie si un message de Pj peut être délivré à Pi :
 *   FIFO      : EMm[j][i] = HM[i][j][i] + 1
 *   Précédence: ∀k≠i : EMm[k][i] ≤ HM[i][k][i]
 */
export function canDeliver(
  hm: MatrixValue,   // matrice locale de Pi
  em: MatrixValue,   // estampille du message
  i: number,         // récepteur
  j: number,         // émetteur
): boolean {
  if (em[j][i] !== hm[j][i] + 1) return false;
  for (let k = 0; k < N; k++) {
    if (k === i) continue;
    if (em[k][i] > hm[k][i]) return false;
  }
  return true;
}

// ─── Scénario ─────────────────────────────────────────────────────────────────
/**
 * Scénario :
 *   P1 local
 *   P1 → P2  (HM[P1][P1,P1]++, HM[P1][P1,P2]++)
 *   P2 reçoit de P1
 *   P2 local
 *   P2 → P3  (HM[P2][P2,P2]++, HM[P2][P2,P3]++)
 *   P3 reçoit de P2
 *   P1 → P4  (HM[P1][P1,P1]++, HM[P1][P1,P4]++)
 *   P4 reçoit de P1
 *   P3 → P5  (HM[P3][P3,P3]++, HM[P3][P3,P5]++)
 *   P5 reçoit de P3
 */
function buildMatrixSteps(): MatrixStep[] {
  const steps: MatrixStep[] = [];
  let mats: MatrixValue[] = Array.from({ length: N }, () => zeroMatrix());

  // Étape 1 — P1 local
  mats = localEvent(mats, 0);
  steps.push({
    t: `P1 événement local — HM[P1][P1,P1] = ${mats[0][0][0]}`,
    tag: 'local',
    from: 0,
    matrices: cloneAll(mats),
  });

  // Étape 2 — P1 → P2
  const s1 = sendEvent(mats, 0, 1);
  mats = s1.mats;
  steps.push({
    t: `P1 envoie à P2 — HM[P1][P1,P1]=${mats[0][0][0]}, HM[P1][P1,P2]=${mats[0][0][1]}`,
    tag: 'send',
    from: 0,
    to: 1,
    matrices: cloneAll(mats),
  });

  // Étape 3 — P2 reçoit de P1
  mats = recvEvent(mats, 1, 0, s1.sent);
  steps.push({
    t: `P2 reçoit de P1 — HM[P2][P2,P2]=${mats[1][1][1]}, HM[P2][P2,P1]=${mats[1][1][0]} (FIFO ✓)`,
    tag: 'recv',
    from: 0,
    to: 1,
    matrices: cloneAll(mats),
  });

  // Étape 4 — P2 local
  mats = localEvent(mats, 1);
  steps.push({
    t: `P2 événement local — HM[P2][P2,P2] = ${mats[1][1][1]}`,
    tag: 'local',
    from: 1,
    matrices: cloneAll(mats),
  });

  // Étape 5 — P2 → P3
  const s2 = sendEvent(mats, 1, 2);
  mats = s2.mats;
  steps.push({
    t: `P2 envoie à P3 — HM[P2][P2,P2]=${mats[1][1][1]}, HM[P2][P2,P3]=${mats[1][1][2]}`,
    tag: 'send',
    from: 1,
    to: 2,
    matrices: cloneAll(mats),
  });

  // Étape 6 — P3 reçoit de P2
  mats = recvEvent(mats, 2, 1, s2.sent);
  steps.push({
    t: `P3 reçoit de P2 — HM[P3][P3,P3]=${mats[2][2][2]}, HM[P3][P3,P2]=${mats[2][2][1]} (FIFO ✓)`,
    tag: 'recv',
    from: 1,
    to: 2,
    matrices: cloneAll(mats),
  });

  // Étape 7 — P1 → P4
  const s3 = sendEvent(mats, 0, 3);
  mats = s3.mats;
  steps.push({
    t: `P1 envoie à P4 — HM[P1][P1,P1]=${mats[0][0][0]}, HM[P1][P1,P4]=${mats[0][0][3]}`,
    tag: 'send',
    from: 0,
    to: 3,
    matrices: cloneAll(mats),
  });

  // Étape 8 — P4 reçoit de P1
  mats = recvEvent(mats, 3, 0, s3.sent);
  steps.push({
    t: `P4 reçoit de P1 — HM[P4][P4,P4]=${mats[3][3][3]}, HM[P4][P4,P1]=${mats[3][3][0]} (FIFO ✓)`,
    tag: 'recv',
    from: 0,
    to: 3,
    matrices: cloneAll(mats),
  });

  // Étape 9 — P3 → P5
  const s4 = sendEvent(mats, 2, 4);
  mats = s4.mats;
  steps.push({
    t: `P3 envoie à P5 — HM[P3][P3,P3]=${mats[2][2][2]}, HM[P3][P3,P5]=${mats[2][2][4]}`,
    tag: 'send',
    from: 2,
    to: 4,
    matrices: cloneAll(mats),
  });

  // Étape 10 — P5 reçoit de P3
  mats = recvEvent(mats, 4, 2, s4.sent);
  steps.push({
    t: `P5 reçoit de P3 — HM[P5][P5,P5]=${mats[4][4][4]}, HM[P5][P5,P3]=${mats[4][4][2]} (FIFO ✓)`,
    tag: 'recv',
    from: 2,
    to: 4,
    matrices: cloneAll(mats),
  });

  return steps;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const MATRIX_STEPS: MatrixStep[] = buildMatrixSteps();

export const MATRIX_RULES = [
  'Événement local Pi :    HM[i][i,i] += 1',
  'Envoi Pi → Pj :         HM[i][i,i] += 1  et  HM[i][i,j] += 1  puis envoyer HM[i]',
  'Réception Pi ← Pj :     HM[i][i,i] += 1  puis ∀(k,l)≠(i,i): max(HM[i][k,l], EMm[k,l])',
  'FIFO :                  EMm[j,i] = HM[i][j,i] + 1',
  'Précédence :            ∀k≠i : EMm[k,i] ≤ HM[i][k,i]',
  'HM[i][j,k] = nbre de msgs de Pj vers Pk dont Pi a connaissance',
] as const;

export const MATRIX_PROPS = [
  { name: 'Délivrance causale',          status: 'ok'   as const, detail: '✓ (condition FIFO + précédence)' },
  { name: 'Ordre FIFO par canal',        status: 'ok'   as const, detail: '✓ HM[i][i,j] mis à jour par fusion max' },
  { name: 'Connaissance indirecte',      status: 'ok'   as const, detail: '✓ fusion de toutes les cases tierces' },
  { name: 'Terminaison garantie',        status: 'ok'   as const, detail: '✓' },
  { name: 'Complexité message',          status: 'warn' as const, detail: 'O(N²) par message' },
] as const;