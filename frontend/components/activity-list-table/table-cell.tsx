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
        'border-colors-dark-neutral-50 flex h-18 items-center border-b px-6 py-4',
        width,
        className,
      )}
    >
      {children}
    </div>
  );
}
