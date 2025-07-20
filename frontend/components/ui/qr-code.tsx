'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

import { cn } from '@/lib/utils';

interface QRCodeProps {
  /** The value to encode in the QR code */
  value: string;
  /** Size of the QR code in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
  /** Network/chain type (no longer used for colors) */
  network?: string;
  /** Error correction level */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  /** Margin around the QR code */
  margin?: number;
  /** Show network icon in center */
  showNetworkIcon?: boolean;
  /** Token symbol for network icon */
  tokenSymbol?: string;
}

// QR code colors - always black for better scanning
const getQRColors = () => {
  return {
    dark: '#000000', // Pure black for better scanning
    light: '#ffffff', // Pure white background
  };
};

export function QRCodeComponent({
  value,
  size = 160,
  className,
  network = 'default',
  errorCorrectionLevel = 'M',
  margin = 2,
  showNetworkIcon = false,
  tokenSymbol,
}: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateQR = async () => {
      if (!canvasRef.current || !value) return;

      try {
        setIsGenerating(true);
        setError(null);

        const colors = getQRColors();

        await QRCode.toCanvas(canvasRef.current, value, {
          width: size,
          margin,
          errorCorrectionLevel,
          color: colors,
        });
      } catch (err) {
        console.error('QR Code generation failed:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to generate QR code',
        );
      } finally {
        setIsGenerating(false);
      }
    };

    generateQR();
  }, [value, size, network, errorCorrectionLevel, margin]);

  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center bg-red-500/5 border border-red-500/20 rounded-sm p-4',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <div className='text-red-500 text-xs font-medium text-center'>
          QR Code Error
        </div>
        <div className='text-red-500/70 text-xs text-center mt-1'>{error}</div>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Loading State */}
      {isGenerating && (
        <div
          className='absolute inset-0 flex flex-col items-center justify-center bg-pastels-polar-100 border border-dark-neutral-50 rounded-sm'
          style={{ width: size, height: size }}
        >
          <div className='animate-spin w-6 h-6 border-2 border-dark-neutral-300 border-t-transparent rounded-full mb-2'></div>
          <div className='text-dark-neutral-400 text-xs font-medium'>
            Generating QR
          </div>
        </div>
      )}

      {/* QR Code Canvas */}
      <canvas
        ref={canvasRef}
        className={cn(
          'rounded-sm border border-dark-neutral-50 transition-opacity',
          isGenerating ? 'opacity-0' : 'opacity-100',
        )}
        style={{
          display: isGenerating ? 'none' : 'block',
          maxWidth: '100%',
          height: 'auto',
        }}
        onClick={() => {
          // Optional: Add click to copy functionality
          if (navigator.clipboard && value) {
            navigator.clipboard.writeText(value);
          }
        }}
      />
    </div>
  );
}

// Export with a more semantic name for the deposit context
export { QRCodeComponent as QRCode };
