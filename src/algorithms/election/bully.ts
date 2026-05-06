export interface Process {
  id: number;
  isAlive: boolean;
  isCoordinator: boolean;
}

export interface Message {
  from: number;
  to: number;
  type: string;
}

export interface ElectionStep {
  description: string;
  title?: string;
  code?: string;
  remarques?: string[];
  tag: 'local' | 'send' | 'recv' | 'elect' | 'coord' | 'crash';
  processes: Process[];
  messages?: Message[];
  highlight?: number[];
}

function makeProcs(n: number, crashedId?: number, coordId?: number): Process[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    isAlive: crashedId !== i + 1,
    isCoordinator: coordId === i + 1,
  }));
}

export function runBullyAlgorithm(): ElectionStep[] {
  const N = 5;

  return [
    {
      title: 'Panne du coordinateur',
      description: 'P5 (coordinateur actuel) tombe en panne. P1 détecte un timeout.',
      code: 'P5 : CRASH\ntimeout détecté par P1\n// aucune réponse au heartbeat',
      tag: 'crash',
      processes: makeProcs(N, 5, 5),
      highlight: [5],
      remarques: [
        ' Bully Algorithm : élit le processus avec le plus grand id actif.',
        ' Détection par timeout de heartbeat périodique.',
        ' P5 (id=5, coordinateur) ne répond plus aux messages.',
      ],
    },
    {
      title: 'P1 lance une ÉLECTION',
      description: 'P1 envoie un message ELECTION à tous les processus d\'id supérieur.',
      code: 'P1.état = ELECTION\nELECTION(id=1) → P2, P3, P4, P5',
      tag: 'elect',
      processes: makeProcs(N, 5),
      messages: [
        { from: 1, to: 2, type: 'ELECTION' },
        { from: 1, to: 3, type: 'ELECTION' },
        { from: 1, to: 4, type: 'ELECTION' },
      ],
      highlight: [1],
      remarques: [
        ' Envoi uniquement vers les processus de rang supérieur (id > 1).',
        ' P1 attend une réponse OK pendant un délai T.',
        ' Si aucune réponse → P1 se proclame coordinateur.',
      ],
    },
    {
      title: 'Les supérieurs répondent OK',
      description: 'P2, P3, P4 reçoivent ELECTION et répondent OK à P1.',
      code: 'P2, P3, P4 reçoivent ELECTION(1)\n→ OK(Pi → P1)  pour i ∈ {2,3,4}\n→ chacun lance sa propre élection',
      tag: 'recv',
      processes: makeProcs(N, 5),
      messages: [
        { from: 2, to: 1, type: 'OK' },
        { from: 3, to: 1, type: 'OK' },
        { from: 4, to: 1, type: 'OK' },
      ],
      highlight: [2, 3, 4],
      remarques: [
        ' Chaque Pi avec id > expéditeur répond OK et lance sa propre élection.',
        ' P1 reçoit au moins un OK → il abandonne et attend le résultat.',
      ],
    },
    {
      title: 'P4 prend le relais',
      description: 'P4, ayant le plus grand id actif, ne reçoit pas de réponse de P5 → il devient coordinateur.',
      code: 'P4 → ELECTION → P5 : timeout (P5 crashé)\nP4.état = COORDINATEUR',
      tag: 'local',
      processes: makeProcs(N, 5, 4),
      highlight: [4],
      remarques: [
        ' Le processus le plus fort sans réponse supérieure s\'auto-élit.',
        ' P4 envoie ELECTION à P5 uniquement — aucune réponse → P4 gagne.',
      ],
    },
    {
      title: 'P4 broadcast COORDINATOR',
      description: 'P4 annonce sa victoire à tous les processus actifs.',
      code: 'COORDINATOR(id=4) → P1, P2, P3',
      tag: 'send',
      processes: makeProcs(N, 5, 4),
      messages: [
        { from: 4, to: 1, type: 'COORD' },
        { from: 4, to: 2, type: 'COORD' },
        { from: 4, to: 3, type: 'COORD' },
      ],
      highlight: [4],
      remarques: [
        ' Message COORDINATOR diffusé à tous les processus vivants.',
        ' Chaque receveur met à jour son pointeur vers le coordinateur.',
      ],
    },
    {
      title: 'Élection terminée',
      description: 'P1, P2, P3 acceptent P4 comme nouveau coordinateur. Élection terminée.',
      code: 'nouveau_coordinateur = P4\nélection terminée ✓',
      tag: 'coord',
      processes: makeProcs(N, 5, 4),
      highlight: [1, 2, 3, 4],
      remarques: [
        ' Correction : le coordinateur élu est toujours le plus grand id actif.',
        ' Complexité : O(N²) messages dans le pire cas.',
        ' Hypothèse : les pannes sont détectables par timeout.',
      ],
    },
  ];
}