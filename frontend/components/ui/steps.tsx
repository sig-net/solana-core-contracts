'use client';

import { CheckCircle, Loader2, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface Step {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'loading' | 'completed' | 'failed';
  icon?: React.ComponentType<{ className?: string }>;
  details?: React.ReactNode;
}

interface StepsProps {
  steps: Step[];
  compact?: boolean;
  showConnector?: boolean;
  className?: string;
}

export function Steps({
  steps,
  compact = false,
  showConnector = true,
  className,
}: StepsProps) {
  const getStepIcon = (step: Step) => {
    const IconComponent = step.icon;

    if (step.status === 'completed') {
      return (
        <CheckCircle
          className={cn('text-green-500', compact ? 'h-4 w-4' : 'h-5 w-5')}
        />
      );
    } else if (step.status === 'loading') {
      return (
        <Loader2
          className={cn(
            'animate-spin text-blue-500',
            compact ? 'h-4 w-4' : 'h-5 w-5',
          )}
        />
      );
    } else if (step.status === 'failed') {
      return (
        <XCircle
          className={cn('text-red-500', compact ? 'h-4 w-4' : 'h-5 w-5')}
        />
      );
    } else if (IconComponent) {
      return (
        <IconComponent
          className={cn('text-gray-400', compact ? 'h-4 w-4' : 'h-5 w-5')}
        />
      );
    } else {
      return (
        <div
          className={cn(
            'rounded-full bg-gray-300',
            compact ? 'h-2 w-2' : 'h-3 w-3',
          )}
        />
      );
    }
  };

  const getStepStatusClass = (step: Step) => {
    if (step.status === 'completed') return 'text-green-600';
    if (step.status === 'loading') return 'text-blue-600';
    if (step.status === 'failed') return 'text-red-600';
    return 'text-gray-500';
  };

  const iconSize = compact ? 'h-6 w-6' : 'h-8 w-8';
  const spacing = compact ? 'gap-2' : 'gap-3';
  const verticalSpacing = compact ? 'pb-3 last:pb-0' : 'pb-6 last:pb-0';

  return (
    <div className={cn('relative', className)}>
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={cn('relative flex items-start', spacing, verticalSpacing)}
        >
          {/* Connector Line */}
          {showConnector && index < steps.length - 1 && (
            <div
              className={cn(
                'absolute w-0.5 bg-gray-300',
                compact ? 'top-6 left-3 h-3' : 'top-8 left-4 h-6',
              )}
            />
          )}

          {/* Step Icon */}
          <div
            className={cn(
              'relative z-10 flex items-center justify-center rounded-full border-2',
              iconSize,
              step.status === 'completed'
                ? 'border-green-500 bg-green-50'
                : step.status === 'loading'
                  ? 'border-blue-500 bg-blue-50'
                  : step.status === 'failed'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-300 bg-gray-50',
            )}
          >
            {getStepIcon(step)}
          </div>

          {/* Step Content */}
          <div className={cn('min-w-0 flex-1', compact ? 'pt-0.5' : 'pt-1')}>
            <div className='flex items-center gap-2'>
              <h3
                className={cn(
                  'font-semibold',
                  compact ? 'text-sm' : 'text-base',
                  getStepStatusClass(step),
                )}
              >
                {step.title}
              </h3>
              {step.status === 'loading' && (
                <div className='flex items-center gap-1'>
                  <div className='h-1 w-1 animate-pulse rounded-full bg-blue-500' />
                  <div className='h-1 w-1 animate-pulse rounded-full bg-blue-500 delay-100' />
                  <div className='h-1 w-1 animate-pulse rounded-full bg-blue-500 delay-200' />
                </div>
              )}
            </div>

            {step.description && (
              <p
                className={cn(
                  'mt-0.5 text-gray-600',
                  compact ? 'text-xs' : 'text-sm',
                )}
              >
                {step.description}
              </p>
            )}

            {step.details && (
              <div className={cn(compact ? 'mt-1' : 'mt-2')}>
                {step.details}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
