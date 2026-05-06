// components/raporlar/PeriyotSelector.tsx

import { PERIYOTLAR, Periyot, BORDO, GRI_METIN } from '@/lib/utils/raporUtils';

interface Props {
  periyot: Periyot;
  onChange: (periyot: Periyot) => void;
}

export default function PeriyotSelector({ periyot, onChange }: Props) {
  return (
    <div className="flex gap-1.5">
      {PERIYOTLAR.map(p => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className="px-3 py-1 rounded-full text-xs border transition-colors"
          style={{
            background: periyot === p.key ? BORDO : 'transparent',
            color: periyot === p.key ? '#fff' : GRI_METIN,
            borderColor: periyot === p.key ? BORDO : '#e5e7eb',
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}