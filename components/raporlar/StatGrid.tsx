// components/raporlar/StatGrid.tsx
import { ReactNode } from 'react';

interface StatGridProps {
  columns?: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}

const colClass: Record<number, string> = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
};

export default function StatGrid({ columns = 3, children, className = '' }: StatGridProps) {
  return (
    <div className={`grid ${colClass[columns]} gap-3 ${className}`}>
      {children}
    </div>
  );
}