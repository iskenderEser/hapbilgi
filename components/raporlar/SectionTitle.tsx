// components/raporlar/SectionTitle.tsx
import { GRI_METIN } from '@/lib/utils/raporUtils';

interface SectionTitleProps {
  children: React.ReactNode;
}

export default function SectionTitle({ children }: SectionTitleProps) {
  return (
    <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>
      {children}
    </div>
  );
}