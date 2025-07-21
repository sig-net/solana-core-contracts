import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  iconClassName?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  iconClassName,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        compact ? 'py-8' : 'min-h-[60vh]',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col items-center justify-center text-center',
          compact ? 'p-8 max-w-md' : 'p-16 max-w-2xl',
        )}
      >
        {Icon && (
          <div
            className={cn(
              'flex items-center justify-center rounded-full mb-6',
              compact ? 'w-16 h-16' : 'w-20 h-20',
              'bg-dark-neutral-800',
              iconClassName,
            )}
          >
            <Icon
              className={cn(
                'text-dark-neutral-400',
                compact ? 'w-8 h-8' : 'w-10 h-10',
              )}
            />
          </div>
        )}

        <h2
          className={cn(
            'font-semibold text-dark-neutral-900 mb-3',
            compact ? 'text-xl' : 'text-3xl',
          )}
        >
          {title}
        </h2>

        {description && (
          <p
            className={cn(
              'text-dark-neutral-600 text-center mb-8',
              compact ? 'text-base max-w-sm' : 'text-lg max-w-md',
            )}
          >
            {description}
          </p>
        )}

        {action && <div className={compact ? '' : 'mt-4'}>{action}</div>}
      </div>
    </div>
  );
}