import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'pending' | 'completed';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variants = {
    pending: 'bg-table-badge-success border-border',
    completed: 'bg-table-badge-bg border-border',
  } as const;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5',
        variants[status],
      )}
    >
      <div className='w-2 h-2 rounded-full bg-green-500' />
      <span className='text-xs font-medium  text-text-secondary'>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </div>
  );
}
