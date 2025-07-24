import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  error: Error | unknown;
  title?: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

export function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
  compact = false,
  className
}: ErrorStateProps) {
  const errorMessage = error instanceof Error 
    ? error.message 
    : 'An unexpected error occurred';

  return (
    <div className={cn(
      'flex flex-col items-center justify-center gap-4',
      compact ? 'p-4' : 'p-8',
      className
    )}>
      <div className="flex flex-col items-center gap-3">
        <AlertCircle 
          className="text-destructive" 
          size={compact ? 32 : 48} 
        />
        <div className="text-center space-y-1">
          <h3 className={cn(
            'font-semibold',
            compact ? 'text-base' : 'text-lg'
          )}>
            {title}
          </h3>
          <p className={cn(
            'text-muted-foreground',
            compact ? 'text-sm' : 'text-base'
          )}>
            {errorMessage}
          </p>
        </div>
      </div>
      
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className="gap-2"
        >
          <RefreshCw size={16} />
          Try again
        </Button>
      )}
    </div>
  );
}