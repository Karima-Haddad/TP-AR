import { createBrowserRouter } from 'react-router-dom';
import FifoPage       from '../pages/FifoPage';
import CausalPage     from '../pages/CausalPage';
import SequencerPage  from '../pages/SequencerPage';

/**
 * Ajoutez ici les routes de vos camarades au fur et à mesure :
 *
 * import ClockPage      from '../pages/ClockPage';
 * import SnapshotPage   from '../pages/SnapshotPage';
 * import MutexPage      from '../pages/MutexPage';
 * import ElectionPage   from '../pages/ElectionPage';
 */

export const router = createBrowserRouter([
  { path: '/',                    element: <FifoPage /> },
  { path: '/diffusion/fifo',      element: <FifoPage /> },
  { path: '/diffusion/causal',    element: <CausalPage /> },
  { path: '/diffusion/sequencer', element: <SequencerPage /> },

  // ── À compléter par vos camarades ──────────────────
  // { path: '/clocks',    element: <ClockPage /> },
  // { path: '/snapshot',  element: <SnapshotPage /> },
  // { path: '/mutex',     element: <MutexPage /> },
  // { path: '/election',  element: <ElectionPage /> },
]);