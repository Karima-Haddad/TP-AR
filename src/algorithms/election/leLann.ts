import type { ElectionStep, Process } from './bully';

function makeProcs(n: number, coordId?: number): Process[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    isAlive: true,
    isCoordinator: coordId === i + 1,
  }));
}

export function runLeLannAlgorithm(): ElectionStep[] {
  const N = 4;

  return [
    {
      title: 'Initialisation',
      description: 'Chaque processus est candidat et envoie son id à son voisin de droite.',
      code: 'état[i] = CANDIDAT pour tout i\nid_max[i] = self.id',
      tag: 'local',
      processes: makeProcs(N),
      highlight: [1, 2, 3, 4],
      remarques: [
        '○ Le Lann (anneau) : précurseur de Chang-Roberts (1977).',
        '📌 Anneau unidirectionnel — messages circulent dans un seul sens.',
        '📐 Chaque processus est initialement candidat à l\'élection.',
      ],
    },
    {
      title: 'Envoi des ids dans l\'anneau',
      description: 'Chaque processus envoie son id à son voisin de droite dans l\'anneau.',
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
      description: 'Chaque processus compare l\'id reçu avec le sien. Si reçu > local → transmet.',
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
        '🔍 Seul le maximum global progresse dans l\'anneau.',
        '✂️ Les ids inférieurs sont supprimés à chaque nœud.',
        '📌 Différence avec Chang-Roberts : pas d\'optimisation supplémentaire.',
      ],
    },
    {
      title: 'P4 détecte sa victoire',
      description: 'P4 reçoit l\'id 4 (le sien) après un tour complet → il est élu coordinateur.',
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
      title: 'Notification dans l\'anneau',
      description: 'P4 propage le message COORDINATOR dans l\'anneau pour informer tous les processus.',
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