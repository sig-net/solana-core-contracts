'use client';

import { getAlchemyProvider } from '@/lib/utils/providers';

export function useAlchemy() {
  return getAlchemyProvider();
}
