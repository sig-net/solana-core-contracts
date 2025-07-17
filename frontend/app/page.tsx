import { DAppContent } from '@/components/dapp-content';

export default function Home() {
  return <DAppContent />;
}

// Force client-side rendering for this page
export const dynamic = 'force-dynamic';
