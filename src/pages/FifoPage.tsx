import { fifoAlgo } from '../algorithms/diffusion/fifoEngine';
import DiffusionPageBase from './DiffusionPageBase';

export default function FifoPage() {
  return <DiffusionPageBase algo={fifoAlgo} />;
}