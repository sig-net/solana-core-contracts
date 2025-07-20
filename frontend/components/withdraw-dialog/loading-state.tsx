'use client';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className='flex flex-col items-center justify-center py-16 space-y-6'>
      <div className='flex items-center gap-2'>
        <div className='w-2 h-2 bg-dark-neutral-300 rounded-full animate-bounce'></div>
        <div
          className='w-2 h-2 bg-dark-neutral-300 rounded-full animate-bounce'
          style={{ animationDelay: '0.1s' }}
        ></div>
        <div
          className='w-2 h-2 bg-dark-neutral-300 rounded-full animate-bounce'
          style={{ animationDelay: '0.2s' }}
        ></div>
      </div>
      <p className='text-dark-neutral-400 text-base font-medium'>{message}</p>
    </div>
  );
}
