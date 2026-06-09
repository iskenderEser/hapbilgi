// components/raporlar/StatCard.tsx
import { BORDO, KIRMIZI, KOYU_METIN, GRI_METIN } from '@/lib/utils/raporUtils';

const BORDER = '#e5e7eb';
const MAVI = '#56aeff';

export type StatCardVariant = 'default' | 'accent' | 'danger' | 'success' | 'warning';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  variant?: StatCardVariant;
  yildiz?: boolean;
}

const valueColor: Record<StatCardVariant, string> = {
  default: KOYU_METIN,
  accent: BORDO,
  danger: KIRMIZI,
  success: '#3B6D11',
  warning: '#854F0B',
};

export default function StatCard({ label, value, sub, variant = 'default', yildiz = false }: StatCardProps) {
  return (
    <div className="rounded-lg p-3 border relative" style={{ background: 'white', borderColor: BORDER }}>
      {yildiz && (
        <svg
          className="absolute top-2 right-2"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={MAVI}
          aria-label="Birinci"
        >
          <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7-6.3-3.8L5.7 21.2l1.7-7L2 9.5l7.1-.6L12 2z" />
        </svg>
      )}
      <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{label}</div>
      <div className="text-xl font-semibold" style={{ color: valueColor[variant] }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: GRI_METIN }}>{sub}</div>}
    </div>
  );
}