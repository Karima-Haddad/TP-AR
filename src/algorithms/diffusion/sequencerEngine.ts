/**
 * Diffusion avec Séquenceur — Implémentation réelle
 * ─────────────────────────────────────────────────────────────────────────────
 * Garantit l'ORDRE TOTAL sur tous les messages diffusés.
 *
 * État du séquenceur S :
 *   nextSeq : number          — prochain numéro global à attribuer
 *
 * État de chaque processus Pi :
 *   nextDeliver[i] : number   — prochain numéro global attendu pour livraison
 *   buffer[i]      : SeqMsg[] — messages reçus hors-ordre (globalSeq > nextDeliver)
 *
 * Protocole (2 phases) :
 *
 *   Phase 1 — Envoi :
 *     Pi.send(m) → envoie m au séquenceur S directement
 *
 *   Phase 2 — Séquençage + Broadcast :
 *     S.recv(m) :
 *       m.globalSeq = nextSeq++
 *       broadcast ORDER(m) à tous (P0..P(N-1))
 *
 *   Livraison chez Pj :
 *     Pj.recv(ORDER(m)) :
 *       si m.globalSeq == nextDeliver[j] → DELIVER, nextDeliver[j]++, tryDeliver
 *       sinon → buffer[j].push(m)
 */

import type { AlgoDef, SimStep } from '../../types/diffusion';

const N = 4;

interface SeqMsg {
  id: string;
  from: number;
  content: string;
  globalSeq?: number;
}

interface SeqState {
  nextSeq:      number;       // compteur du séquenceur
  nextDeliver:  number[];     // nextDeliver[i] chez Pi
  buffers:      SeqMsg[][];   // buffers[i]
  delivered:    string[][];
}

function clone(s: SeqState): SeqState {
  return {
    nextSeq:     s.nextSeq,
    nextDeliver: [...s.nextDeliver],
    buffers:     s.buffers.map(b => b.map(m => ({ ...m }))),
    delivered:   s.delivered.map(d => [...d]),
  };
}

function clockLabel(s: SeqState): string[] {
  return Array.from({ length: N }, (_, i) => `nd=${s.nextDeliver[i]}`);
}

function tryDeliver(s: SeqState, j: number, push: (p: Omit<SimStep,'clocks'>) => void): void {
  let progress = true;
  while (progress) {
    progress = false;
    const idx = s.buffers[j].findIndex(m => m.globalSeq === s.nextDeliver[j]);
    if (idx !== -1) {
      const m = s.buffers[j].splice(idx, 1)[0];
      s.nextDeliver[j]++;
      s.delivered[j].push(m.id);
      push({
        title: `P${j} livre ${m.id} (globalSeq=${m.globalSeq}) depuis buffer`,
        description: `globalSeq=${m.globalSeq} == nextDeliver[${j}]=${s.nextDeliver[j]-1} ✓ → DELIVER. nextDeliver[${j}]→${s.nextDeliver[j]}.`,
        tag: 'deliver', activeFrom: -1, activeTo: j,
        remarks: [
          `✅ Livraison en cascade de ${m.id} chez P${j}.`,
          `🔄 nextDeliver[${j}] : ${s.nextDeliver[j]-1} → ${s.nextDeliver[j]}.`,
        ],
      });
      progress = true;
    }
  }
}

export function runSequencer(): SimStep[] {
  const steps: SimStep[] = [];
  let s: SeqState = {
    nextSeq:     0,
    nextDeliver: Array(N).fill(0),
    buffers:     Array.from({ length: N }, () => []),
    delivered:   Array.from({ length: N }, () => []),
  };

  function push(partial: Omit<SimStep, 'clocks'>) {
    steps.push({ ...partial, clocks: clockLabel(s) });
  }

  /* 0 — init */
  push({
    title: 'Initialisation',
    description: 'S.nextSeq=0. nextDeliver[i]=0 pour tous.',
    tag: 'order',
    remarks: [
      '📌 Séquenceur S : processus central qui attribue un numéro global à chaque message.',
      '🔢 nextSeq : prochain numéro global que S va attribuer.',
      '🔢 nextDeliver[i] : prochain numéro global attendu par Pi pour livraison.',
      '🏆 Garantit l\'ordre total : tous les processus livrent les messages dans le même ordre.',
      '⚠️ Point unique de défaillance : si S tombe, la diffusion est interrompue.',
    ],
  });

  /* 1 — P0 envoie mA au séquenceur */
  const mA: SeqMsg = { id: 'mA', from: 0, content: 'mA' };
  push({
    title: 'P0 envoie mA au séquenceur S (phase 1)',
    description: 'P0 veut diffuser mA. Phase 1 : envoie mA directement à S. Pas encore broadcast.',
    tag: 'send', activeFrom: 0, activeTo: -1,
    transitMsg: { id: mA.id, from: 0, to: -1, content: mA.content },
    remarks: [
      '📤 Phase 1 : Pi envoie m au séquenceur uniquement (pas aux autres processus).',
      '⏳ P0 n\'envoie PAS mA aux autres encore — il attend l\'ORDER de S.',
      '📡 P0 → S seulement.',
    ],
  });

  /* 2 — P2 envoie mB au séquenceur (concurrent) */
  const mB: SeqMsg = { id: 'mB', from: 2, content: 'mB' };
  push({
    title: 'P2 envoie mB au séquenceur S (concurrent)',
    description: 'Simultanément, P2 envoie mB à S. Les deux messages sont en transit vers S.',
    tag: 'send', activeFrom: 2, activeTo: -1,
    transitMsg: { id: mB.id, from: 2, to: -1, content: mB.content },
    remarks: [
      '⚡ Deux envois concurrents : mA (de P0) et mB (de P2) arrivent à S.',
      '🎯 L\'ordre de réception par S détermine l\'ordre total.',
      '🔑 C\'est ici que l\'arbitrage de l\'ordre total est effectué.',
    ],
  });

  /* 3 — S reçoit mA → attribue globalSeq=0 */
  s = clone(s);
  mA.globalSeq = s.nextSeq;
  s.nextSeq++;
  push({
    title: `S reçoit mA → globalSeq=${mA.globalSeq}, nextSeq→${s.nextSeq}`,
    description: `S attribue mA.globalSeq = nextSeq = ${mA.globalSeq}. nextSeq++ → ${s.nextSeq}.`,
    tag: 'recv', activeFrom: 0, activeTo: -1,
    remarks: [
      `🔢 mA.globalSeq = nextSeq = ${mA.globalSeq}.`,
      `⬆️ S.nextSeq : ${mA.globalSeq} → ${s.nextSeq}.`,
      '📡 S va broadcaster ORDER(mA, globalSeq=0) à tous.',
    ],
  });

  /* 4 — S broadcast ORDER(mA, 0) */
  push({
    title: 'S broadcast ORDER(mA, globalSeq=0)',
    description: `Phase 2 : S envoie ORDER(mA, 0) à P0, P1, P2, P3.`,
    tag: 'send', activeFrom: -1, activeTo: 0,
    transitMsg: { id: mA.id, from: -1, to: -1, content: mA.content, globalSeq: mA.globalSeq },
    remarks: [
      `📡 Phase 2 : S broadcast ORDER(mA, globalSeq=${mA.globalSeq}) → P0, P1, P2, P3.`,
      '⚠️ Même P0 (émetteur original) reçoit l\'ORDER de S avant de livrer mA.',
      '🏛️ S est le seul arbitre : personne ne livre sans son ORDER.',
    ],
  });

  /* 5 — Tous livrent mA */
  s = clone(s);
  for (let j = 0; j < N; j++) {
    s.nextDeliver[j]++;
    s.delivered[j].push(mA.id);
  }
  push({
    title: 'Tous livrent mA (globalSeq=0 == nextDeliver=0)',
    description: `Pour chaque Pj : globalSeq(mA)=0 == nextDeliver[j]=0 ✓ → DELIVER(mA). nextDeliver[j]++ → 1.`,
    tag: 'deliver', activeFrom: -1, activeTo: 1,
    remarks: [
      '✅ Livraison simultanée de mA chez P0, P1, P2, P3.',
      `🔄 nextDeliver[j] : 0 → 1 pour tous.`,
      '🎯 mA est le 1er message livré par tous — ordre total initié.',
    ],
  });

  /* 6 — S reçoit mB → attribue globalSeq=1 */
  s = clone(s);
  mB.globalSeq = s.nextSeq;
  s.nextSeq++;
  push({
    title: `S reçoit mB → globalSeq=${mB.globalSeq}, nextSeq→${s.nextSeq}`,
    description: `S attribue mB.globalSeq = nextSeq = ${mB.globalSeq}. nextSeq++ → ${s.nextSeq}.`,
    tag: 'recv', activeFrom: 2, activeTo: -1,
    remarks: [
      `🔢 mB.globalSeq = nextSeq = ${mB.globalSeq}.`,
      `⬆️ S.nextSeq : ${mB.globalSeq} → ${s.nextSeq}.`,
      '⚡ Même si mB a été envoyé "en même temps" que mA, S a reçu mA en premier → mB après.',
    ],
  });

  /* 7 — S broadcast ORDER(mB, 1) */
  push({
    title: 'S broadcast ORDER(mB, globalSeq=1)',
    description: `Phase 2 : S envoie ORDER(mB, 1) à P0, P1, P2, P3.`,
    tag: 'send', activeFrom: -1, activeTo: 2,
    transitMsg: { id: mB.id, from: -1, to: -1, content: mB.content, globalSeq: mB.globalSeq },
    remarks: [
      `📡 Phase 2 : S broadcast ORDER(mB, globalSeq=${mB.globalSeq}) → tous.`,
      `🔑 L\'ordre total est : mA (0) < mB (1) — décidé par S.`,
    ],
  });

  /* 8 — Tous livrent mB */
  s = clone(s);
  for (let j = 0; j < N; j++) {
    s.nextDeliver[j]++;
    s.delivered[j].push(mB.id);
  }
  push({
    title: 'Tous livrent mB (globalSeq=1 == nextDeliver=1)',
    description: `Pour chaque Pj : globalSeq(mB)=1 == nextDeliver[j]=1 ✓ → DELIVER(mB). nextDeliver[j]++ → 2.`,
    tag: 'deliver', activeFrom: -1, activeTo: 2,
    remarks: [
      '✅ Livraison simultanée de mB chez tous. nextDeliver→2.',
      `📊 État final : P0,P1,P2,P3 ont tous livré [mA, mB] dans cet ordre.`,
      '🏆 Ordre total vérifié : Séquenceur ⊃ Causal ⊃ FIFO.',
      '📊 Coût : 2 × (N-1) messages par diffusion (Pi→S + S→tous).',
      '⚠️ Bottleneck : S est un goulot d\'étranglement. Non tolérant aux pannes sans réplication de S.',
    ],
  });

  return steps;
}

export const sequencerAlgo: AlgoDef = {
  id: 'sequencer',
  label: 'Diffusion avec Séquenceur',
  icon: 'S',
  pill: 'Séquenceur',
  pillClass: 'pill-green',
  description: 'Un séquenceur central attribue un ordre global à tous les messages.',
  steps: runSequencer(),
};