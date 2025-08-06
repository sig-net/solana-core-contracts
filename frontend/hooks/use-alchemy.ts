'use client';

import { useMemo } from 'react';

import { getAlchemyProvider } from '@/lib/utils/providers';

export function useAlchemy() {
  return useMemo(() => getAlchemyProvider(), []);
}
