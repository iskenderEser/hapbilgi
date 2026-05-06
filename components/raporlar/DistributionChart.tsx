// components/raporlar/DistributionChart.tsx

import { barGenislik, BORDO, GRI_METIN, GRI_ZEMIN, KOYU_METIN } from '@/lib/utils/raporUtils';

interface DataItem {
  [key: string]: string | number;
}

interface Props {
  title: string;
  data: DataItem[];
  labelKey: string;
  valueKey: string;
}

export default function DistributionChart({ title, data, labelKey, valueKey }: Props) {
  const max = Math.max(...data.map(item => item[valueKey] as number), 1);

  return (
    <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
      <div className="text-sm font-medium mb-3" style={{ color: KOYU_METIN }}>{title}</div>
      {data.map(item => (
        <div key={item[labelKey] as string} className="flex items-center gap-2 mb-2">
          <span className="text-xs truncate" style={{ color: GRI_METIN, width: 96 }}>{item[labelKey]}</span>
          <div className="flex-1 h-1.5 rounded-full" style={{ background: GRI_ZEMIN }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${barGenislik(item[valueKey] as number, max)}%`, background: BORDO }}
            />
          </div>
          <span className="text-xs text-right" style={{ color: GRI_METIN, width: 28 }}>{item[valueKey]}</span>
        </div>
      ))}
    </div>
  );
}