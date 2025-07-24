'use client';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className='flex flex-col items-center justify-center space-y-6 py-16'>
      <div className='flex items-center gap-2'>
        <div className='bg-dark-neutral-300 h-2 w-2 animate-bounce rounded-full'></div>
        <div
          className='bg-dark-neutral-300 h-2 w-2 animate-bounce rounded-full'
          style={{ animationDelay: '0.1s' }}
        ></div>
        <div
          className='bg-dark-neutral-300 h-2 w-2 animate-bounce rounded-full'
          style={{ animationDelay: '0.2s' }}
        ></div>
      </div>
      <p className='text-dark-neutral-400 text-base font-medium'>{message}</p>
    </div>
  );
}
