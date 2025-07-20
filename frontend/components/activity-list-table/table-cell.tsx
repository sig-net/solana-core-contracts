import { cn } from '@/lib/utils';

interface TableCellProps {
  children: React.ReactNode;
  width: string;
  className?: string;
}

export function TableCell({ children, width, className }: TableCellProps) {
  return (
    <div
      className={cn(
        'h-18 border-b border-colors-dark-neutral-50 px-6 py-4 flex items-center',
        width,
        className,
      )}
    >
      {children}
    </div>
  );
}
