'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';

interface TruncatedTextProps {
  text: string;
  maxLength?: number;
  showTooltip?: boolean;
  className?: string;
  copyable?: boolean;
  prefixLength?: number;
  suffixLength?: number;
  ellipsis?: string;
}

export function TruncatedText({
  text,
  maxLength = 20,
  showTooltip = true,
  className,
  copyable = false,
  prefixLength,
  suffixLength,
  ellipsis = '...',
}: TruncatedTextProps) {
  const [copied, setCopied] = useState(false);

  // If prefixLength and suffixLength are provided, use middle truncation (good for addresses/hashes)
  const getTruncatedText = () => {
    if (!text) return '';

    if (text.length <= maxLength) {
      return text;
    }

    if (prefixLength !== undefined && suffixLength !== undefined) {
      // Middle truncation (e.g., "0x1234...abcd")
      const prefix = text.slice(0, prefixLength);
      const suffix = text.slice(-suffixLength);
      return `${prefix}${ellipsis}${suffix}`;
    }

    // End truncation (e.g., "This is a long text...")
    return `${text.slice(0, maxLength - ellipsis.length)}${ellipsis}`;
  };

  const handleCopy = async () => {
    if (!copyable) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const truncatedText = getTruncatedText();
  const isTextTruncated = truncatedText !== text;

  return (
    <span
      className={cn(
        'inline-flex items-center',
        copyable && 'cursor-pointer transition-colors hover:text-blue-600',
        className,
      )}
      onClick={handleCopy}
      title={showTooltip && isTextTruncated ? text : undefined}
    >
      <span className='font-mono text-sm'>{truncatedText}</span>
      {copyable && (
        <span className='ml-1 text-gray-400 hover:text-gray-600'>
          {copied ? (
            <Check className='h-3 w-3' />
          ) : (
            <Copy className='h-3 w-3' />
          )}
        </span>
      )}
    </span>
  );
}
