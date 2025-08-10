import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variants = {
    pending: 'bg-colors-pastels-polar-100 border-colors-dark-neutral-50',
    processing: 'bg-colors-pastels-polar-100 border-colors-dark-neutral-50',
    completed: 'bg-colors-pastels-polar-100 border-colors-dark-neutral-50',
    failed: 'bg-red-50 border-red-200',
  } as const;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5',
        variants[status],
      )}
    >
      <div
        className={cn(
          'h-2 w-2 rounded-full',
          status === 'failed'
            ? 'bg-red-500'
            : status === 'processing'
              ? 'animate-pulse bg-blue-500'
              : 'bg-success-500',
        )}
      />
      <span className='text-colors-dark-neutral-500 text-xs font-medium'>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </div>
  );
}
