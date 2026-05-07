/* ═══════════════════════════════════════════════════════════════
   LE LANN ALGORITHM — Implémentation générique + étapes de simulation
   DistribuLab · v2.0
═══════════════════════════════════════════════════════════════ */

import type { ElectionStep, Process } from './bully';

/* ─── Helper ─────────────────────────────────────────────────── */
function makeProcs(n: number, coordId?: number): Process[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    isAlive: true,
    isCoordinator: coordId === i + 1,
  }));
}

/* ═══════════════════════════════════════════════════════════════
   IMPLÉMENTATION GÉNÉRIQUE
   Le Lann (1977) : algorithme fondateur d'élection en anneau.
   Précurseur de Chang-Roberts — même structure mais sans
   l'optimisation d'absorption précoce des petits ids.

   Chaque processus :
     1. Envoie son propre id à son voisin de droite
     2. Reçoit un id entrant :
        - id reçu > id local  → transmet l'id reçu et met à jour id_max
        - id reçu = id local  → ce processus est élu (tour complet)
        - id reçu < id local  → ignore (ne transmet pas)
     3. Le gagnant broadcast COORDINATOR dans l'anneau

   Différence vs Chang-Roberts :
     - Pas d'optimisation O(n log n) : tous les tours peuvent être parcourus
     - Complexité pire cas : O(n²) messages
     - Plus simple, base pédagogique essentielle
═══════════════════════════════════════════════════════════════ */
export class LeLannNode {
  id: number;
  isAlive: boolean;
  isCoordinator: boolean;
  coordinatorId: number | null;
  idMax: number;
  private next: LeLannNode | null = null;

  constructor(id: number) {
    this.id = id;
    this.isAlive = true;
    this.isCoordinator = false;
    this.coordinatorId = null;
    this.idMax = id; // initialement, chaque nœud se connaît lui-même
  }

  /** Définit le voisin de droite dans l'anneau */
  setNext(node: LeLannNode): void {
    this.next = node;
  }

  /** Lance l'élection : envoie son propre id au voisin de droite */
  startElection(): void {
    if (!this.isAlive || !this.next) return;
    console.log(`P${this.id} (CANDIDAT) — envoie id:${this.id} →`);
    this.next.receiveId(this.id);
  }

  /** Reçoit un id entrant depuis le voisin de gauche */
  receiveId(receivedId: number): void {
    if (!this.isAlive || !this.next) return;

    if (receivedId > this.id) {
      // Transmettre : l'id reçu est plus grand que le local
      this.idMax = receivedId;
      console.log(`P${this.id} : id:${receivedId} > local(${this.id}) → transmet`);
      this.next.receiveId(receivedId);

    } else if (receivedId === this.id) {
      // Tour complet : ce processus est le gagnant
      console.log(`P${this.id} : id:${receivedId} == self.id → COORDINATEUR !`);
      this.isCoordinator = true;
      this.coordinatorId = this.id;
      // Notifier l'anneau
      this.next.receiveCoordinator(this.id);

    } else {
      // Ignorer : l'id reçu est inférieur au local
      console.log(`P${this.id} : id:${receivedId} < local(${this.id}) → ignoré`);
    }
  }

  /** Propage la notification COORDINATOR dans l'anneau */
  receiveCoordinator(coordId: number): void {
    if (!this.isAlive) return;
    if (coordId === this.id) {
      // La notification a fait le tour, arrêt
      console.log(`P${this.id} : notification COORDINATOR bouclée — fin`);
      return;
    }
    this.coordinatorId = coordId;
    console.log(`P${this.id} accepte P${coordId} comme coordinateur`);
    this.next?.receiveCoordinator(coordId);
  }
}

/** Crée et initialise un anneau de N nœuds Le Lann */
export function buildLeLannRing(n: number): LeLannNode[] {
  const nodes = Array.from({ length: n }, (_, i) => new LeLannNode(i + 1));
  nodes.forEach((node, i) => node.setNext(nodes[(i + 1) % n]));
  return nodes;
}

/** Lance l'élection sur tout l'anneau (tous candidats simultanément) */
export function runLeLannExample(): void {
  const nodes = buildLeLannRing(4);
  nodes.forEach(n => n.startElection());
}

/* ═══════════════════════════════════════════════════════════════
   ÉTAPES DE SIMULATION (pour DistribuLab)
═══════════════════════════════════════════════════════════════ */
export function runLeLannAlgorithm(): ElectionStep[] {
  const N = 4;

  return [
    {
      title: 'Initialisation',
      description: "Chaque processus est candidat et envoie son id à son voisin de droite.",
      code: 'état[i] = CANDIDAT pour tout i\nid_max[i] = self.id',
      tag: 'local',
      processes: makeProcs(N),
      highlight: [1, 2, 3, 4],
      remarques: [
        '○ Le Lann (anneau) : précurseur de Chang-Roberts (1977).',
        '📌 Anneau unidirectionnel — messages circulent dans un seul sens.',
        "📐 Chaque processus est initialement candidat à l'élection.",
      ],
    },
    {
      title: "Envoi des ids dans l'anneau",
      description: "Chaque processus envoie son id à son voisin de droite dans l'anneau.",
      code: 'P1 → id:1 → P2\nP2 → id:2 → P3\nP3 → id:3 → P4\nP4 → id:4 → P1',
      tag: 'send',
      processes: makeProcs(N),
      messages: [
        { from: 1, to: 2, type: 'id:1' },
        { from: 2, to: 3, type: 'id:2' },
        { from: 3, to: 4, type: 'id:3' },
        { from: 4, to: 1, type: 'id:4' },
      ],
      highlight: [1, 2, 3, 4],
      remarques: [
        '📨 Sens : sens horaire uniquement.',
        '📐 Phase 1 : N messages initiaux.',
      ],
    },
    {
      title: 'Comparaison et transfert',
      description: "Chaque processus compare l'id reçu avec le sien. Si reçu > local → transmet.",
      code: 'si recv.id > local.id :\n  transmettre(recv.id)\n  local.id_max = recv.id\nsinon :\n  ignorer',
      tag: 'recv',
      processes: makeProcs(N),
      messages: [
        { from: 1, to: 2, type: 'id:4' },
        { from: 2, to: 3, type: 'id:4' },
        { from: 3, to: 4, type: 'id:4' },
      ],
      highlight: [1, 2, 3],
      remarques: [
        "🔍 Seul le maximum global progresse dans l'anneau.",
        '✂️ Les ids inférieurs sont supprimés à chaque nœud.',
        '📌 Différence avec Chang-Roberts : pas d\'optimisation supplémentaire.',
      ],
    },
    {
      title: 'P4 détecte sa victoire',
      description: "P4 reçoit l'id 4 (le sien) après un tour complet → il est élu coordinateur.",
      code: 'P4 reçoit id:4\nid reçu == self.id\n→ P4 = COORDINATEUR',
      tag: 'elect',
      processes: makeProcs(N, 4),
      messages: [
        { from: 3, to: 4, type: 'id:4' },
      ],
      highlight: [4],
      remarques: [
        '⭐ Condition de victoire : recevoir son propre id après un tour.',
        '✅ Garantie : le plus grand id gagne toujours.',
      ],
    },
    {
      title: "Notification dans l'anneau",
      description: "P4 propage le message COORDINATOR dans l'anneau pour informer tous les processus.",
      code: 'COORDINATOR(4) → P3 → P2 → P1',
      tag: 'coord',
      processes: makeProcs(N, 4),
      messages: [
        { from: 4, to: 3, type: 'COORD' },
        { from: 3, to: 2, type: 'COORD' },
        { from: 2, to: 1, type: 'COORD' },
      ],
      highlight: [4],
      remarques: [
        '📢 Propagation inverse pour la notification (sens antihoraire ou second passage).',
        '📐 N-1 messages supplémentaires.',
      ],
    },
    {
      title: 'Élection terminée',
      description: 'Tous les processus reconnaissent P4 comme coordinateur. Système stable.',
      code: 'nouveau_coordinateur = P4\nélection terminée ✓',
      tag: 'coord',
      processes: makeProcs(N, 4),
      highlight: [1, 2, 3, 4],
      remarques: [
        '✅ Terminaison garantie en anneau sans panne.',
        '📐 Complexité : O(n²) messages dans le pire cas.',
        '📌 Algorithme fondateur — base de Chang-Roberts et des variantes modernes.',
      ],
    },
  ];
}