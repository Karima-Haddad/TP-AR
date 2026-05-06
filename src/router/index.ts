import { runBullyAlgorithm } from '../algorithms/election/bully';
import { runChangRobertsAlgorithm } from '../algorithms/election/changRoberts';
import { runLeLannAlgorithm } from '../algorithms/election/leLann';
import type { ElectionStep } from '../algorithms/election/bully';
 
export interface AlgoRoute {
  path: string;
  label: string;
  run: () => ElectionStep[];
}
 
export const ELECTION_ROUTES: AlgoRoute[] = [
  {
    path: 'bully',
    label: 'Bully Algorithm',
    run: runBullyAlgorithm,
  },
  {
    path: 'chang-roberts',
    label: 'Chang-Roberts',
    run: runChangRobertsAlgorithm,
  },
  {
    path: 'lelann',
    label: 'Le Lann (anneau)',
    run: runLeLannAlgorithm,
  },
];
 