'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
  showText?: boolean;
}

export function CopyButton({
  text,
  className,
  size = 'sm',
  variant = 'ghost',
  showText = false,
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleCopy}
      className={cn('gap-2', className)}
      aria-label={`Copy ${text}`}
    >
      {isCopied ? (
        <>
          <Check className='h-3 w-3' />
          {showText && 'Copied!'}
        </>
      ) : (
        <>
          <Copy className='h-3 w-3' />
          {showText && 'Copy'}
        </>
      )}
    </Button>
  );
}
