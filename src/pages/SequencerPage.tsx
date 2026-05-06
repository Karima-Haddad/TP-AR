import { sequencerAlgo } from '../algorithms/diffusion/sequencerEngine';
import DiffusionPageBase from './DiffusionPageBase';

export default function SequencerPage() {
  return <DiffusionPageBase algo={sequencerAlgo} />;
}