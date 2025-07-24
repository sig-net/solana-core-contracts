import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'pending' | 'completed';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variants = {
    pending: 'bg-colors-pastels-polar-100 border-colors-dark-neutral-50',
    completed: 'bg-colors-pastels-polar-100 border-colors-dark-neutral-50',
  } as const;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5',
        variants[status],
      )}
    >
      <div className='bg-success-500 h-2 w-2 rounded-full' />
      <span className='text-colors-dark-neutral-500 text-xs font-medium'>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </div>
  );
}
