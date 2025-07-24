import { cn } from '@/lib/utils';

interface TableHeaderProps {
  children: React.ReactNode;
  width: string;
}

export function TableHeader({ children, width }: TableHeaderProps) {
  return (
    <div
      className={cn(
        'border-colors-dark-neutral-200 text-colors-dark-neutral-500 flex h-12 items-center border-b-2 px-6 py-3 text-xs font-bold',
        width,
      )}
    >
      {children}
    </div>
  );
}
