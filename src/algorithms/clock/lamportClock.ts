import type { LamportStep, LamportClocks } from '../../types/clock.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const clone = (c: LamportClocks): LamportClocks => [...c] as LamportClocks;

function localEvent(clocks: LamportClocks, i: number): LamportClocks {
  const next = clone(clocks);
  next[i] += 1;
  return next;
}

function sendEvent(
  clocks: LamportClocks,
  i: number,
): { clocks: LamportClocks; ts: number } {
  const next = clone(clocks);
  next[i] += 1;
  return { clocks: next, ts: next[i] };
}

function recvEvent(
  clocks: LamportClocks,
  j: number,
  ts: number,
): LamportClocks {
  const next = clone(clocks);
  next[j] = Math.max(next[j], ts) + 1;
  return next;
}

// ─── Scénario ─────────────────────────────────────────────────────────────────

function buildLamportSteps(): LamportStep[] {
  const steps: LamportStep[] = [];
  let c: LamportClocks = [0, 0, 0, 0, 0];

  // Étape 1 — P1 événement local
  c = localEvent(c, 0);
  steps.push({
    t: 'P1 exécute un événement local e₁ — horloge incrémentée',
    tag: 'local',
    from: 0,
    clocks: clone(c),
  });

  // Étape 2 — P1 envoie à P2
  const s1 = sendEvent(c, 0);
  c = s1.clocks;
  steps.push({
    t: `P1 envoie un message à P2 avec estampille ts = ${s1.ts}`,
    tag: 'send',
    from: 0,
    to: 1,
    clocks: clone(c),
  });

  // Étape 3 — P2 reçoit de P1
  c = recvEvent(c, 1, s1.ts);
  steps.push({
    t: `P2 reçoit de P1 — C[P2] = max(0, ${s1.ts}) + 1 = ${c[1]}`,
    tag: 'recv',
    from: 0,
    to: 1,
    clocks: clone(c),
  });

  // Étape 4 — P2 événement local
  c = localEvent(c, 1);
  steps.push({
    t: 'P2 exécute un événement local e₂',
    tag: 'local',
    from: 1,
    clocks: clone(c),
  });

  // Étape 5 — P2 envoie à P3
  const s2 = sendEvent(c, 1);
  c = s2.clocks;
  steps.push({
    t: `P2 envoie un message à P3 avec estampille ts = ${s2.ts}`,
    tag: 'send',
    from: 1,
    to: 2,
    clocks: clone(c),
  });

  // Étape 6 — P3 reçoit de P2
  c = recvEvent(c, 2, s2.ts);
  steps.push({
    t: `P3 reçoit de P2 — C[P3] = max(0, ${s2.ts}) + 1 = ${c[2]}`,
    tag: 'recv',
    from: 1,
    to: 2,
    clocks: clone(c),
  });

  // Étape 7 — P3 événement local
  c = localEvent(c, 2);
  steps.push({
    t: 'P3 exécute un événement local e₃',
    tag: 'local',
    from: 2,
    clocks: clone(c),
  });

  // Étape 8 — P1 envoie à P4
  const s3 = sendEvent(c, 0);
  c = s3.clocks;
  steps.push({
    t: `P1 envoie un message à P4 avec estampille ts = ${s3.ts}`,
    tag: 'send',
    from: 0,
    to: 3,
    clocks: clone(c),
  });

  // Étape 9 — P4 reçoit de P1
  c = recvEvent(c, 3, s3.ts);
  steps.push({
    t: `P4 reçoit de P1 — C[P4] = max(0, ${s3.ts}) + 1 = ${c[3]}`,
    tag: 'recv',
    from: 0,
    to: 3,
    clocks: clone(c),
  });

  // Étape 10 — P4 événement local
  c = localEvent(c, 3);
  steps.push({
    t: 'P4 exécute un événement local e₄',
    tag: 'local',
    from: 3,
    clocks: clone(c),
  });

  // Étape 11 — P3 envoie à P5
  const s4 = sendEvent(c, 2);
  c = s4.clocks;
  steps.push({
    t: `P3 envoie un message à P5 avec estampille ts = ${s4.ts}`,
    tag: 'send',
    from: 2,
    to: 4,
    clocks: clone(c),
  });

  // Étape 12 — P5 reçoit de P3
  c = recvEvent(c, 4, s4.ts);
  steps.push({
    t: `P5 reçoit de P3 — C[P5] = max(0, ${s4.ts}) + 1 = ${c[4]}`,
    tag: 'recv',
    from: 2,
    to: 4,
    clocks: clone(c),
  });

  // Étape 13 — P5 événement local
  c = localEvent(c, 4);
  steps.push({
    t: 'P5 exécute un événement local e₅ — chaîne causale complète',
    tag: 'local',
    from: 4,
    clocks: clone(c),
  });

  return steps;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const LAMPORT_STEPS: LamportStep[] = buildLamportSteps();

export const LAMPORT_RULES = [
  'Événement local :  C[i] = C[i] + 1',
  'Envoi :            C[i] = C[i] + 1  puis envoyer ts = C[i]',
  'Réception de ts :  C[j] = max(C[j], ts) + 1',
] as const;

export const LAMPORT_PROPS = [
  { name: 'Ordre causal respecté',    status: 'ok'   as const, detail: '✓' },
  { name: 'Ordre total possible',     status: 'ok'   as const, detail: '✓ (bris de liens par id)' },
  { name: 'Détection de concurrence', status: 'warn' as const, detail: '✗ (horloges vectorielles requises)' },
  { name: 'Terminaison garantie',     status: 'ok'   as const, detail: '✓' },
  { name: 'Complexité message',       status: 'ok'   as const, detail: 'O(1) par message' },
] as const;