/* ═══════════════════════════════════════════════════════════════
   CHANG-ROBERTS ALGORITHM — Implémentation générique + étapes de simulation
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
   Chang-Roberts : élection dans un anneau unidirectionnel.
   Chaque processus envoie son id dans le sens horaire.
   Règle de transfert :
     - msg.id > self.id  → transmettre au voisin suivant
     - msg.id = self.id  → ce processus est élu (son id a fait le tour)
     - msg.id < self.id  → ignorer (absorber le message)
   Complexité : O(n log n) en moyenne, O(n²) au pire.
═══════════════════════════════════════════════════════════════ */
export class ChangRobertsNode {
  id: number;
  isAlive: boolean;
  isCoordinator: boolean;
  coordinatorId: number | null;
  private next: ChangRobertsNode | null = null;

  constructor(id: number) {
    this.id = id;
    this.isAlive = true;
    this.isCoordinator = false;
    this.coordinatorId = null;
  }

  /** Définit le voisin de droite dans l'anneau */
  setNext(node: ChangRobertsNode): void {
    this.next = node;
  }

  /** Lance l'élection : envoie son propre id */
  startElection(): void {
    if (!this.isAlive || !this.next) return;
    console.log(`P${this.id} démarre — envoie ELECTION(${this.id})`);
    this.next.receiveElection(this.id);
  }

  /** Reçoit un message ELECTION(candidateId) */
  receiveElection(candidateId: number): void {
    if (!this.isAlive || !this.next) return;

    if (candidateId > this.id) {
      // Transmettre : l'id candidat est plus grand
      console.log(`P${this.id} : ELECTION(${candidateId}) > ${this.id} → transmet`);
      this.next.receiveElection(candidateId);
    } else if (candidateId === this.id) {
      // Ce processus a reçu son propre id → il est élu
      console.log(`P${this.id} : reçoit son propre id → COORDINATEUR !`);
      this.isCoordinator = true;
      this.coordinatorId = this.id;
      this.next.receiveCoordinator(this.id);
    } else {
      // Absorber : l'id candidat est inférieur
      console.log(`P${this.id} : ELECTION(${candidateId}) < ${this.id} → ignoré`);
    }
  }

  /** Propage la notification COORDINATOR dans l'anneau */
  receiveCoordinator(coordId: number): void {
    if (!this.isAlive) return;
    if (coordId === this.id) {
      // Le message a fait le tour, arrêt
      console.log(`P${this.id} : notification COORDINATOR bouclée — fin`);
      return;
    }
    this.coordinatorId = coordId;
    console.log(`P${this.id} accepte P${coordId} comme coordinateur`);
    this.next?.receiveCoordinator(coordId);
  }
}

/** Crée et initialise un anneau de N nœuds Chang-Roberts */
export function buildChangRobertsRing(n: number): ChangRobertsNode[] {
  const nodes = Array.from({ length: n }, (_, i) => new ChangRobertsNode(i + 1));
  nodes.forEach((node, i) => node.setNext(nodes[(i + 1) % n]));
  return nodes;
}

/** Lance l'élection sur tout l'anneau (tous candidats simultanément) */
export function runChangRobertsExample(): void {
  const nodes = buildChangRobertsRing(4);
  nodes.forEach(n => n.startElection());
}

/* ═══════════════════════════════════════════════════════════════
   ÉTAPES DE SIMULATION (pour DistribuLab)
═══════════════════════════════════════════════════════════════ */
export function runChangRobertsAlgorithm(): ElectionStep[] {
  const N = 4;

  return [
    {
      title: 'Initialisation',
      description: "Chaque processus démarre une élection en envoyant son id dans l'anneau.",
      code: 'sendSeq[i] = 0 pour tous.\nnextDeliver[j][i] = 0 pour tous\nles canaux (i=source, j=destinataire).',
      tag: 'local',
      processes: makeProcs(N),
      highlight: [1, 2, 3, 4],
      remarques: [
        '📌 Chang-Roberts : élection dans un anneau unidirectionnel.',
        '🔑 Chaque processus envoie son propre id à son voisin de droite.',
        '📐 Complexité moyenne : O(n log n) messages.',
      ],
    },
    {
      title: 'Envoi des candidatures',
      description: "Chaque processus envoie son id dans l'anneau (sens horaire).",
      code: 'P1 → ELECTION(1) → P2\nP2 → ELECTION(2) → P3\nP3 → ELECTION(3) → P4\nP4 → ELECTION(4) → P1',
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
        '📨 Envoi simultané dans le sens horaire uniquement.',
        '📐 N messages initiaux, un par processus.',
      ],
    },
    {
      title: 'Propagation — filtre par max',
      description: "Chaque processus transmet le message uniquement si l'id reçu est supérieur au sien.",
      code: 'règle : si msg.id > self.id → transmettre\n        si msg.id = self.id → élu !\n        si msg.id < self.id → ignorer',
      tag: 'recv',
      processes: makeProcs(N),
      messages: [
        { from: 2, to: 3, type: 'id:4' },
        { from: 3, to: 4, type: 'id:4' },
      ],
      highlight: [2, 3],
      remarques: [
        '🔍 Seul le plus grand id "survit" à chaque étape.',
        '✂️ Les petits ids sont absorbés — réduction du trafic.',
        '📐 Optimisation vs algorithme naïf O(n²).',
      ],
    },
    {
      title: 'P4 reconnaît son propre id',
      description: "P4 reçoit son propre id après le tour complet de l'anneau → il est élu.",
      code: 'P4 reçoit ELECTION(4)\nmsg.id == self.id → COORDINATEUR !',
      tag: 'elect',
      processes: makeProcs(N, 4),
      messages: [
        { from: 1, to: 4, type: 'id:4' },
      ],
      highlight: [4],
      remarques: [
        '⭐ Un processus est élu quand son propre id revient à lui.',
        '✅ Garantie : le processus avec le plus grand id gagne toujours.',
      ],
    },
    {
      title: 'P4 broadcast COORDINATOR',
      description: "P4 diffuse un message COORDINATOR dans l'anneau pour informer tous les processus.",
      code: 'COORDINATOR(id=4) → anneau complet',
      tag: 'coord',
      processes: makeProcs(N, 4),
      messages: [
        { from: 4, to: 3, type: 'COORD' },
        { from: 3, to: 2, type: 'COORD' },
        { from: 2, to: 1, type: 'COORD' },
      ],
      highlight: [4],
      remarques: [
        "📢 Le coordinateur se propage dans l'anneau.",
        '📐 N-1 messages supplémentaires pour la notification.',
      ],
    },
    {
      title: 'Élection terminée',
      description: 'Tous les processus connaissent P4 comme coordinateur.',
      code: 'nouveau_coordinateur = P4\nélection terminée ✓',
      tag: 'coord',
      processes: makeProcs(N, 4),
      highlight: [1, 2, 3, 4],
      remarques: [
        '✅ Algorithme correct et terminaison garantie.',
        '📐 Total : O(n log n) messages en moyenne, O(n²) au pire.',
        '📌 Anneau unidirectionnel : aucune réponse directe nécessaire.',
      ],
    },
  ];
}