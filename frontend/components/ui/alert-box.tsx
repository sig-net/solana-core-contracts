import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface AlertBoxProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}

const variantClasses = {
  info: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  success:
    'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
  warning:
    'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
  error:
    'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
};

const titleClasses = {
  info: 'text-blue-800 dark:text-blue-200',
  success: 'text-green-800 dark:text-green-200',
  warning: 'text-yellow-800 dark:text-yellow-200',
  error: 'text-red-800 dark:text-red-200',
};

const contentClasses = {
  info: 'text-blue-700 dark:text-blue-300',
  success: 'text-green-700 dark:text-green-300',
  warning: 'text-yellow-700 dark:text-yellow-300',
  error: 'text-red-700 dark:text-red-300',
};

export function AlertBox({
  variant = 'info',
  title,
  children,
  icon: Icon,
  className = '',
}: AlertBoxProps) {
  return (
    <div
      className={`mt-4 p-4 rounded-lg border ${variantClasses[variant]} ${className}`}
    >
      {(title || Icon) && (
        <div className='flex items-center gap-2 mb-2'>
          {Icon && <Icon className='w-4 h-4' />}
          {title && (
            <span className={`text-sm font-medium ${titleClasses[variant]}`}>
              {title}
            </span>
          )}
        </div>
      )}
      <div className={`text-xs ${contentClasses[variant]}`}>{children}</div>
    </div>
  );
}
