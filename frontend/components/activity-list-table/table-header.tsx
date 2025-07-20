import { cn } from '@/lib/utils';

interface TableHeaderProps {
  children: React.ReactNode;
  width: string;
}

export function TableHeader({ children, width }: TableHeaderProps) {
  return (
    <div
      className={cn(
        'h-12 border-b-2 border-colors-dark-neutral-200 px-6 py-3 font-bold text-xs text-colors-dark-neutral-500 flex items-center',
        width,
      )}
    >
      {children}
    </div>
  );
}
