import { useParams, Navigate } from 'react-router-dom';
import { ELECTION_ROUTES } from '../router';
import ElectionSimulator from '../components/ElectionSimulator';
import "../styles/election.css";

const ALGO_META: Record<string, {
  sub: string;
  tag: string;
  tagClass: string;
  topo: string;
}> = {
  bully: {
    sub: 'élection · tolérance aux pannes · identifiants uniques',
    tag: 'Élection',
    tagClass: 'pill-purple',
    topo: 'complet',
  },
  'chang-roberts': {
    sub: 'élection · anneau unidirectionnel · O(n log n)',
    tag: 'Élection',
    tagClass: 'pill-purple',
    topo: 'anneau',
  },
  lelann: {
    sub: 'élection · anneau · Le Lann–Chang–Roberts',
    tag: 'Élection',
    tagClass: 'pill-purple',
    topo: 'anneau',
  },
};

export default function ElectionPage() {
  const { algo } = useParams<{ algo: string }>();

  const current = ELECTION_ROUTES.find(r => r.path === algo);

  if (!current) {
    return <Navigate to="/election/bully" replace />;
  }

  const steps = current.run();
  const meta = ALGO_META[current.path] ?? ALGO_META['bully'];
  const nProcs = steps[0]?.processes?.length ?? 5;

  return (
  <div className="election-page">
    <ElectionSimulator
      key={current.path}
      steps={steps}
      algoLabel={current.label}
      algoSub={meta.sub}
      algoTag={meta.tag}
      algoTagClass={meta.tagClass}
      metaProcs={`${nProcs} processus`}
      metaTopo={meta.topo}
    />
  </div>
);
}
