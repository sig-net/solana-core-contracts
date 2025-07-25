'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import { getAddressExplorerUrl } from '@/lib/utils/network-utils';

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
            <svg className='h-3 w-3' fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                clipRule='evenodd'
              />
            </svg>
          ) : (
            <svg
              className='h-3 w-3'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
              />
            </svg>
          )}
        </span>
      )}
    </span>
  );
}

// Specific variants for common use cases
export function TruncatedAddress({
  address,
  className,
  copyable = true,
  showExplorerLink = false,
  networkName = 'sepolia',
}: {
  address: string;
  className?: string;
  copyable?: boolean;
  showExplorerLink?: boolean;
  networkName?: string;
}) {
  const baseComponent = (
    <TruncatedText
      text={address}
      prefixLength={6}
      suffixLength={4}
      className={className}
      copyable={copyable}
      showTooltip={true}
    />
  );

  if (showExplorerLink) {
    return (
      <div className='flex items-center gap-1'>
        {baseComponent}
        <a
          href={getAddressExplorerUrl(address, networkName)}
          target='_blank'
          rel='noopener noreferrer'
          className='text-gray-400 transition-colors hover:text-blue-600'
          title='View on explorer'
        >
          <svg
            className='h-3 w-3'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
            />
          </svg>
        </a>
      </div>
    );
  }

  return baseComponent;
}

export function TruncatedHash({
  hash,
  className,
  copyable = true,
}: {
  hash: string;
  className?: string;
  copyable?: boolean;
}) {
  return (
    <TruncatedText
      text={hash}
      prefixLength={8}
      suffixLength={6}
      className={className}
      copyable={copyable}
      showTooltip={true}
    />
  );
}
