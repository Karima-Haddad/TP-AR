/**
 * Diffusion Causale — Implémentation réelle (algorithme BSS)
 * ─────────────────────────────────────────────────────────────────────────────
 * Chaque processus Pi maintient :
 *   VC[i] : vecteur d'horloge de taille N
 *
 * SEND(Pi, m) :
 *   VC[i][i]++
 *   m.vc = copy(VC[i])
 *   broadcast(m)
 *
 * RECV(Pj, m de Pi) :
 *   Condition de livraison :
 *     (1) m.vc[i] == VC[j][i] + 1        (m est le prochain message de Pi)
 *     (2) m.vc[k] <= VC[j][k]  ∀k ≠ i   (Pj a vu tout ce que Pi avait vu)
 *   Si satisfait → DELIVER : VC[j] = max(VC[j], m.vc) composante par composante
 *   Sinon → buffer
 *   Après chaque livraison → tryDeliver sur le buffer
 */

import type { AlgoDef, SimStep } from '../../types/diffusion';

const N = 4;

interface CausalMsg {
  id: string;
  from: number;
  vc: number[];
  content: string;
}

interface CausalState {
  vc:        number[][];   // vc[i] = vecteur d'horloge de Pi
  buffers:   CausalMsg[][]; // buffers[j] = messages en attente chez Pj
  delivered: string[][];
}

function clone(s: CausalState): CausalState {
  return {
    vc:        s.vc.map(v => [...v]),
    buffers:   s.buffers.map(b => b.map(m => ({ ...m, vc: [...m.vc] }))),
    delivered: s.delivered.map(d => [...d]),
  };
}

function clockLabel(s: CausalState): string[] {
  return s.vc.map(v => '[' + v.join(',') + ']');
}

/** Condition de livraison BSS */
function canDeliver(msg: CausalMsg, vcJ: number[]): boolean {
  const i = msg.from;
  if (msg.vc[i] !== vcJ[i] + 1) return false;
  for (let k = 0; k < N; k++) {
    if (k !== i && msg.vc[k] > vcJ[k]) return false;
  }
  return true;
}

/** Fusion point-à-point : VC[j] = max(VC[j], m.vc) */
function mergeVC(vcJ: number[], msgVC: number[]): number[] {
  return vcJ.map((v, k) => Math.max(v, msgVC[k]));
}

/** Essaie de livrer tous les messages en attente (cascade) */
function tryDeliverBuffer(s: CausalState, j: number, steps: SimStep[], push: (p: Omit<SimStep,'clocks'>) => void): void {
  let progress = true;
  while (progress) {
    progress = false;
    for (let idx = 0; idx < s.buffers[j].length; idx++) {
      const m = s.buffers[j][idx];
      if (canDeliver(m, s.vc[j])) {
        s.buffers[j].splice(idx, 1);
        s.vc[j] = mergeVC(s.vc[j], m.vc);
        s.delivered[j].push(m.id);
        push({
          title: `P${j} livre ${m.id} depuis buffer (cascade)`,
          description: `Condition satisfaite après mise à jour. VC[${j}] = [${s.vc[j].join(',')}].`,
          tag: 'deliver',
          activeFrom: m.from,
          activeTo: j,
          remarks: [
            `✅ Livraison en cascade de ${m.id} chez P${j}.`,
            `🔄 VC[${j}] mis à jour : [${s.vc[j].join(',')}].`,
          ],
        });
        progress = true;
        break;
      }
    }
  }
}

export function runCausal(): SimStep[] {
  const steps: SimStep[] = [];
  let s: CausalState = {
    vc:        Array.from({ length: N }, () => Array(N).fill(0)),
    buffers:   Array.from({ length: N }, () => []),
    delivered: Array.from({ length: N }, () => []),
  };

  function push(partial: Omit<SimStep, 'clocks'>) {
    steps.push({ ...partial, clocks: clockLabel(s) });
  }

  /* 0 — init */
  push({
    title: 'Initialisation',
    description: 'VC[i] = [0,0,0,0] pour tous les processus.',
    tag: 'order',
    remarks: [
      '📌 Causalité : si m → m\' (m précède causalement m\'), tout Pj livre m avant m\'.',
      '🔢 VC[i][j] = nombre de messages de Pj déjà livrés par Pi.',
      '📐 Condition BSS : m.vc[from]==VC[j][from]+1 ET m.vc[k]≤VC[j][k] ∀k≠from.',
      '💡 Causal implique FIFO, mais pas l\'inverse.',
    ],
  });

  /* 1 — P0 envoie m1 à P1 et P2 */
  s = clone(s);
  s.vc[0][0]++;
  const m1: CausalMsg = { id: 'm1', from: 0, vc: [...s.vc[0]], content: 'm1' };
  push({
    title: 'P0 envoie m1 → P1, P2',
    description: `VC[0][0]++ → VC[0]=[${s.vc[0].join(',')}]. m1.vc=[${m1.vc.join(',')}]. Envoi à P1 et P2.`,
    tag: 'send', activeFrom: 0, activeTo: 1,
    transitMsg: { id: m1.id, from: 0, to: -1, content: m1.content, vectorClock: m1.vc },
    remarks: [
      `📤 SEND(P0, m1) : VC[0][0]++ → VC[0]=[${s.vc[0].join(',')}].`,
      `🏷️ m1 estampillé avec vc=[${m1.vc.join(',')}].`,
      '📡 Envoi à P1 et P2.',
    ],
  });

  /* 2 — P1 reçoit m1 et envoie m2 (dépendance causale sur m1) */
  {
    const j = 1;
    const ok = canDeliver(m1, s.vc[j]);
    s = clone(s);
    if (ok) {
      s.vc[j] = mergeVC(s.vc[j], m1.vc);
      s.delivered[j].push(m1.id);
    }
    // P1 émet m2 après avoir reçu m1
    s.vc[j][j]++;
    const m2: CausalMsg = { id: 'm2', from: j, vc: [...s.vc[j]], content: 'm2' };

    push({
      title: 'P1 reçoit m1 → DELIVER, puis envoie m2',
      description: `Condition : m1.vc[0]=${m1.vc[0]}==VC[1][0]+1=1 ✓, m1.vc[k≠0]=0≤0 ✓ → DELIVER(m1). VC[1]=[${s.vc[j].join(',')}] après fusion. P1 émet m2 avec vc=[${m2.vc.join(',')}].`,
      tag: 'recv', activeFrom: 0, activeTo: j,
      transitMsg: { id: m1.id, from: 0, to: j, content: m1.content, vectorClock: m1.vc },
      remarks: [
        `✅ Condition (1) : m1.vc[0]=${m1.vc[0]} == VC[1][0]+1=${s.vc[j][0]-1}+1 → VRAI.`,
        `✅ Condition (2) : m1.vc[k≠0]=0 ≤ VC[1][k]=0 → VRAI.`,
        `🔄 VC[1] = max(VC[1], m1.vc) = [${s.vc[j].join(',')}].`,
        `📤 P1 incrémente VC[1][1]++ et envoie m2 avec vc=[${m2.vc.join(',')}].`,
        '⚠️ m2 dépend causalement de m1 : m1 → m2.',
      ],
    });

    /* 3 — P2 reçoit m2 AVANT m1 (désordre) */
    {
      const j2 = 2;
      const ok2 = canDeliver(m2, s.vc[j2]);  // false : m2.vc[0]=1 > VC[2][0]=0
      s = clone(s);
      if (!ok2) s.buffers[j2].push(m2);
      push({
        title: 'P2 reçoit m2 avant m1 — buffer',
        description: `Condition (1) : m2.vc[1]=${m2.vc[1]}==VC[2][1]+1=1 ✓. Condition (2) : m2.vc[0]=${m2.vc[0]} > VC[2][0]=0 ✗ → NON livré → buffer.`,
        tag: 'wait', activeFrom: j, activeTo: j2, waiting: [j2],
        transitMsg: { id: m2.id, from: j, to: j2, content: m2.content, vectorClock: m2.vc },
        remarks: [
          `⚠️ m2 arrive avant m1 chez P2 (désordre réseau).`,
          `🔍 Condition (1) : m2.vc[1]=${m2.vc[1]} == VC[2][1]+1=1 → VRAI.`,
          `🛑 Condition (2) : m2.vc[0]=${m2.vc[0]} > VC[2][0]=0 → FAUX. P2 n\'a pas encore livré m1 (de P0).`,
          `📦 m2 mis en buffer. Différence clé avec FIFO : on vérifie TOUTES les dépendances causales.`,
        ],
      });
    }

    /* 4 — P2 reçoit m1 → livraison + cascade m2 */
    {
      const j2 = 2;
      const ok1 = canDeliver(m1, s.vc[j2]); // true
      s = clone(s);
      if (ok1) {
        s.vc[j2] = mergeVC(s.vc[j2], m1.vc);
        s.delivered[j2].push(m1.id);
      }
      push({
        title: 'P2 reçoit m1 → DELIVER(m1)',
        description: `Condition m1 : m1.vc[0]=1==VC[2][0]+1=1 ✓, autres=0≤0 ✓ → DELIVER(m1). VC[2]=[${s.vc[j2].join(',')}].`,
        tag: 'recv', activeFrom: 0, activeTo: j2,
        transitMsg: { id: m1.id, from: 0, to: j2, content: m1.content, vectorClock: m1.vc },
        remarks: [
          `✅ DELIVER(m1) : toutes conditions satisfaites.`,
          `🔄 VC[2] = [${s.vc[j2].join(',')}]. Appel tryDeliver(buffer)...`,
        ],
      });

      // cascade : m2 est maintenant livrable
      tryDeliverBuffer(s, j2, steps, push);
    }

    /* 5 — P3 reçoit m1 puis m2 */
    {
      const j3 = 3;
      s = clone(s);
      if (canDeliver(m1, s.vc[j3])) {
        s.vc[j3] = mergeVC(s.vc[j3], m1.vc);
        s.delivered[j3].push(m1.id);
      }
      if (canDeliver(m2, s.vc[j3])) {
        s.vc[j3] = mergeVC(s.vc[j3], m2.vc);
        s.delivered[j3].push(m2.id);
      }
      push({
        title: 'P3 livre m1 puis m2',
        description: `P3 reçoit m1 et m2 dans l'ordre. Les deux conditions sont satisfaites séquentiellement.`,
        tag: 'deliver', activeFrom: 0, activeTo: j3,
        remarks: [
          `✅ DELIVER(m1) puis DELIVER(m2) chez P3.`,
          `📊 VC[3]=[${s.vc[j3].join(',')}].`,
          '✔️ Propriété causale : m1 → m2 respectée chez tous les processus.',
          '❌ Causal ne garantit pas l\'ordre total (messages concurrents peuvent diverger).',
          '📚 Algo BSS (Birman-Schiper-Stephenson, 1987). Coût : O(N) par message.',
        ],
      });
    }
  }

  return steps;
}

export const causalAlgo: AlgoDef = {
  id: 'causal',
  label: 'Diffusion Causale',
  icon: '→',
  pill: 'Causal',
  pillClass: 'pill-purple',
  description: 'Tout message causalement antérieur est livré avant ses successeurs causaux.',
  steps: runCausal(),
};