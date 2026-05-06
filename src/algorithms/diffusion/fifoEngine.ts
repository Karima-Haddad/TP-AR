/**
 * Diffusion FIFO — Implémentation réelle
 * ─────────────────────────────────────────────────────────────────────────────
 * Chaque canal (Pi → Pj) a :
 *   - sendSeq[i]        : numéro de séquence du prochain envoi de Pi
 *   - nextDeliver[j][i] : prochain numéro attendu de Pi chez Pj
 *   - buffer[j][i]      : messages de Pi en attente chez Pj
 *
 * Règles :
 *   SEND(Pi, m)  → seqNum = sendSeq[i]++, broadcast
 *   RECV(Pj, m)  → si m.seqNum == nextDeliver[j][from] → DELIVER, nextDeliver++
 *                  sinon → buffer[j][from].push(m)
 *   après DELIVER → tryDeliver(j, from) : vider buffer en cascade
 */

import type { AlgoDef, SimStep } from '../../types/diffusion';

const N = 4;

interface Msg { id: string; from: number; seqNum: number; content: string; }

interface FifoState {
  sendSeq:     number[];
  nextDeliver: number[][];
  buffers:     Msg[][][];
  delivered:   string[][];
}

function clone(s: FifoState): FifoState {
  return {
    sendSeq:     [...s.sendSeq],
    nextDeliver: s.nextDeliver.map(r => [...r]),
    buffers:     s.buffers.map(bj => bj.map(bi => [...bi])),
    delivered:   s.delivered.map(d => [...d]),
  };
}

function clockLabel(s: FifoState): string[] {
  return Array.from({ length: N }, (_, i) =>
    'nd=' + s.nextDeliver[i].join(',')
  );
}

export function runFifo(): SimStep[] {
  const steps: SimStep[] = [];
  let s: FifoState = {
    sendSeq:     Array(N).fill(0),
    nextDeliver: Array.from({ length: N }, () => Array(N).fill(0)),
    buffers:     Array.from({ length: N }, () => Array.from({ length: N }, () => [])),
    delivered:   Array.from({ length: N }, () => []),
  };

  function push(partial: Omit<SimStep, 'clocks'>) {
    steps.push({ ...partial, clocks: clockLabel(s) });
  }

  /* 0 — init */
  push({
    title: 'Initialisation',
    description: 'sendSeq[i]=0 pour tous. nextDeliver[j][i]=0 pour tous les canaux (i=source, j=destinataire).',
    tag: 'order',
    remarks: [
      '📌 FIFO garantit l\'ordre par canal : si Pi envoie m1 puis m2, tout Pj livre m1 avant m2.',
      '🔢 sendSeq[i] : prochain numéro de séquence attaché par Pi à son message.',
      '🔢 nextDeliver[j][i] : numéro attendu par Pj sur le canal Pi→Pj.',
      '📦 buffer[j][i] : messages de Pi arrivés hors-ordre chez Pj, en attente.',
    ],
  });

  /* 1 — P0 send m1 */
  const m1: Msg = { id: 'm1', from: 0, seqNum: s.sendSeq[0], content: 'm1' };
  s = clone(s); s.sendSeq[0]++;
  push({
    title: 'P0 broadcast m1 (seqNum=0)',
    description: `seqNum = sendSeq[0] = ${m1.seqNum}. sendSeq[0]++ → ${s.sendSeq[0]}. Broadcast vers P1, P2, P3.`,
    tag: 'send', activeFrom: 0, activeTo: -1,
    transitMsg: { id: m1.id, from: 0, to: -1, content: m1.content, seqNum: m1.seqNum },
    remarks: [
      `📤 SEND(P0, m1) : attache seqNum=${m1.seqNum} (= sendSeq[0] avant incrémentation).`,
      `⬆️ sendSeq[0] : 0 → ${s.sendSeq[0]}.`,
      '📡 m1 part en broadcast vers P1, P2, P3.',
    ],
  });

  /* 2 — P0 send m2 */
  const m2: Msg = { id: 'm2', from: 0, seqNum: s.sendSeq[0], content: 'm2' };
  s = clone(s); s.sendSeq[0]++;
  push({
    title: 'P0 broadcast m2 (seqNum=1)',
    description: `seqNum = sendSeq[0] = ${m2.seqNum}. sendSeq[0]++ → ${s.sendSeq[0]}. Broadcast vers P1, P2, P3.`,
    tag: 'send', activeFrom: 0, activeTo: -1,
    transitMsg: { id: m2.id, from: 0, to: -1, content: m2.content, seqNum: m2.seqNum },
    remarks: [
      `📤 SEND(P0, m2) : attache seqNum=${m2.seqNum}.`,
      `⬆️ sendSeq[0] : 1 → ${s.sendSeq[0]}.`,
      '⚠️ m2 peut arriver avant m1 chez certains processus (réseau asynchrone).',
    ],
  });

  /* 3 — P1 recv m1 (ordre correct) */
  {
    const j = 1;
    const nd = s.nextDeliver[j][m1.from]; // 0
    const ok = m1.seqNum === nd;
    s = clone(s);
    if (ok) { s.nextDeliver[j][m1.from]++; s.delivered[j].push(m1.id); }
    push({
      title: 'P1 reçoit m1 → livraison directe',
      description: `seqNum(m1)=${m1.seqNum} == nextDeliver[1][0]=${nd} ✓ → DELIVER(m1). nextDeliver[1][0]++ → ${s.nextDeliver[j][m1.from]}.`,
      tag: 'deliver', activeFrom: 0, activeTo: j,
      transitMsg: { id: m1.id, from: 0, to: j, content: m1.content, seqNum: m1.seqNum },
      remarks: [
        `✅ Condition : ${m1.seqNum} == ${nd} → VRAI → DELIVER(m1).`,
        `🔄 nextDeliver[1][0] : ${nd} → ${s.nextDeliver[j][m1.from]}.`,
        '🔍 Vérification buffer[1][0] → vide.',
      ],
    });
  }

  /* 4 — P1 recv m2 (ordre correct) */
  {
    const j = 1;
    const nd = s.nextDeliver[j][m2.from]; // 1
    const ok = m2.seqNum === nd;
    s = clone(s);
    if (ok) { s.nextDeliver[j][m2.from]++; s.delivered[j].push(m2.id); }
    push({
      title: 'P1 reçoit m2 → livraison directe',
      description: `seqNum(m2)=${m2.seqNum} == nextDeliver[1][0]=${nd} ✓ → DELIVER(m2). nextDeliver[1][0]++ → ${s.nextDeliver[j][m2.from]}.`,
      tag: 'deliver', activeFrom: 0, activeTo: j,
      transitMsg: { id: m2.id, from: 0, to: j, content: m2.content, seqNum: m2.seqNum },
      remarks: [
        `✅ Condition : ${m2.seqNum} == ${nd} → VRAI → DELIVER(m2).`,
        `🔄 nextDeliver[1][0] : ${nd} → ${s.nextDeliver[j][m2.from]}.`,
        '🏁 P1 a livré [m1, m2] dans l\'ordre. FIFO respecté.',
      ],
    });
  }

  /* 5 — P2 recv m2 AVANT m1 (désordre) */
  {
    const j = 2;
    const nd = s.nextDeliver[j][m2.from]; // 0
    const ok = m2.seqNum === nd;          // 1 != 0 → false
    s = clone(s);
    if (!ok) s.buffers[j][m2.from].push(m2);
    push({
      title: 'P2 reçoit m2 avant m1 — buffer',
      description: `seqNum(m2)=${m2.seqNum} ≠ nextDeliver[2][0]=${nd} → buffer[2][0].push(m2). P2 attend m1 (seqNum=0).`,
      tag: 'wait', activeFrom: 0, activeTo: j, waiting: [j],
      transitMsg: { id: m2.id, from: 0, to: j, content: m2.content, seqNum: m2.seqNum },
      remarks: [
        `⚠️ Désordre réseau : m2 (seqNum=${m2.seqNum}) arrive avant m1 (seqNum=0) chez P2.`,
        `🛑 ${m2.seqNum} ≠ nextDeliver[2][0]=${nd} → NON livré → buffer[2][0] = [m2].`,
        `⏳ P2 bloqué sur canal P0→P2, attend seqNum=${nd}.`,
      ],
    });
  }

  /* 6 — P2 recv m1 → livraison + cascade */
  {
    const j = 2;
    const nd0 = s.nextDeliver[j][m1.from]; // 0
    s = clone(s);
    // DELIVER m1
    s.nextDeliver[j][m1.from]++;
    s.delivered[j].push(m1.id);
    // tryDeliver : m2 dans buffer, seqNum=1 == nextDeliver[j][0]=1 → DELIVER m2
    s.buffers[j][m2.from] = [];
    s.nextDeliver[j][m2.from]++;
    s.delivered[j].push(m2.id);
    push({
      title: 'P2 reçoit m1 → livraison + cascade de m2',
      description: `DELIVER(m1) : ${nd0}==${nd0} ✓. nextDeliver[2][0]→1. tryDeliver : m2 en buffer (seqNum=1==1) → DELIVER(m2). nextDeliver[2][0]→${s.nextDeliver[j][m2.from]}.`,
      tag: 'deliver', activeFrom: 0, activeTo: j,
      transitMsg: { id: m1.id, from: 0, to: j, content: m1.content, seqNum: m1.seqNum },
      remarks: [
        `✅ DELIVER(m1) : seqNum=0 == nextDeliver[2][0]=0 → VRAI.`,
        `🔄 nextDeliver[2][0] : 0 → 1. Appel tryDeliver(2, 0)...`,
        `✅ buffer[2][0] contient m2 (seqNum=1) == nextDeliver[2][0]=1 → DELIVER(m2) en cascade.`,
        '🏁 P2 livre [m1, m2] dans l\'ordre malgré le désordre réseau. FIFO respecté.',
      ],
    });
  }

  /* 7 — P3 recv m1 et m2 (ordre correct) */
  {
    const j = 3;
    s = clone(s);
    s.nextDeliver[j][m1.from]++; s.delivered[j].push(m1.id);
    s.nextDeliver[j][m2.from]++; s.delivered[j].push(m2.id);
    push({
      title: 'P3 reçoit m1 puis m2 — livraison directe',
      description: 'P3 reçoit les deux messages dans l\'ordre. Les conditions seqNum==nextDeliver sont satisfaites sans attente.',
      tag: 'deliver', activeFrom: 0, activeTo: j,
      remarks: [
        '✅ DELIVER(m1) puis DELIVER(m2) sans buffer.',
        `📊 État final — livrés : P1=[m1,m2] P2=[m1,m2] P3=[m1,m2].`,
        '✔️ Propriété FIFO globalement vérifiée.',
        '❌ FIFO ne garantit pas l\'ordre entre messages de sources différentes.',
        '📚 Complexité : O(1) par livraison, O(n) messages max en buffer par canal.',
      ],
    });
  }

  return steps;
}

export const fifoAlgo: AlgoDef = {
  id: 'fifo',
  label: 'Diffusion FIFO',
  icon: '⇉',
  pill: 'FIFO',
  pillClass: '',
  description: 'Les messages d\'un même émetteur sont livrés dans l\'ordre d\'envoi.',
  steps: runFifo(),
};