import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className='text-center py-12 space-y-4'>
      <div className='w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto'>
        <Icon className='h-6 w-6 text-muted-foreground' />
      </div>
      <div className='space-y-2'>
        <h3 className='font-medium'>{title}</h3>
        <p className='text-sm text-muted-foreground max-w-md mx-auto'>
          {description}
        </p>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
