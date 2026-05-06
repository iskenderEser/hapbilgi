// components/raporlar/StatCard.tsx
import { BORDO, KIRMIZI, KOYU_METIN, GRI_METIN } from '@/lib/utils/raporUtils';

const BORDER = '#e5e7eb';

export type StatCardVariant = 'default' | 'accent' | 'danger' | 'success' | 'warning';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  variant?: StatCardVariant;
}

const valueColor: Record<StatCardVariant, string> = {
  default: KOYU_METIN,
  accent: BORDO,
  danger: KIRMIZI,
  success: '#3B6D11',
  warning: '#854F0B',
};

export default function StatCard({ label, value, sub, variant = 'default' }: StatCardProps) {
  return (
    <div className="rounded-lg p-3 border" style={{ background: 'white', borderColor: BORDER }}>
      <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{label}</div>
      <div className="text-xl font-semibold" style={{ color: valueColor[variant] }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: GRI_METIN }}>{sub}</div>}
    </div>
  );
}