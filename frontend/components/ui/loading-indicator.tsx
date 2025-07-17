import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface LoadingIndicatorProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingIndicator({
  message = 'Loading...',
  size = 'sm',
  className = '',
}: LoadingIndicatorProps) {
  return (
    <div className={`flex items-center justify-center space-x-2 ${className}`}>
      <LoadingSpinner size={size} />
      <span className='text-sm text-gray-600 dark:text-gray-400'>
        {message}
      </span>
    </div>
  );
}
