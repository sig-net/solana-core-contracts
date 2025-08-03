import { getAlchemyProvider } from '@/lib/utils/providers';

/**
 * Get Alchemy SDK instance
 * @deprecated Use getAlchemyProvider from @/lib/utils/providers instead
 */
export function getAlchemy() {
  return getAlchemyProvider();
}

// Export the instance for direct use
export const alchemy = getAlchemy();
