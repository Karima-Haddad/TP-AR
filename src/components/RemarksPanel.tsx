import type { SimStep, EventTag } from '../types/diffusion';

interface Props {
  step: SimStep;
  stepIndex: number;
  totalSteps: number;
}

const TAG_INFO: Record<EventTag, { label: string; cls: string }> = {
  send:    { label: 'envoi',    cls: 'sb-send' },
  recv:    { label: 'réception', cls: 'sb-recv' },
  wait:    { label: 'attente',  cls: 'sb-wait' },
  deliver: { label: 'livraison', cls: 'sb-deliver' },
  order:   { label: 'propriété', cls: 'sb-order' },
};

export default function RemarksPanel({ step, stepIndex, totalSteps }: Props) {
  const tag = TAG_INFO[step.tag] ?? { label: step.tag, cls: 'sb-order' };

  return (
    <div className="rpanel-body">
      {/* En-tête de l'étape */}
      <div className="remark-header">
        <div className="remark-step-num">ÉTAPE {stepIndex + 1} / {totalSteps}</div>
        <div className="remark-title">{step.title}</div>
        <div className="remark-desc">{step.description}</div>
        <div className="step-badges">
          <span className={`sbadge ${tag.cls}`}>{tag.label}</span>
        </div>
      </div>

      {/* Séparateur */}
      <div className="remark-sep" />

      {/* Remarques */}
      <div className="remark-section-title">Remarques</div>
      <div className="remarks-list">
        {step.remarks.map((r, i) => (
          <div key={i} className="remark-item">
            <div className="remark-text">{r}</div>
          </div>
        ))}
      </div>
    </div>
  );
}