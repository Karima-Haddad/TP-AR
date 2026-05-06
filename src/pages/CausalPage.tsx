import { causalAlgo } from '../algorithms/diffusion/causalEngine';
import DiffusionPageBase from './DiffusionPageBase';

export default function CausalPage() {
  return <DiffusionPageBase algo={causalAlgo} />;
}