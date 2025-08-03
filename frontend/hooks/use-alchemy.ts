'use client';

import { useMemo } from 'react';

import { getAlchemy } from '@/lib/services/alchemy-service';

export function useAlchemy() {
  return useMemo(() => getAlchemy(), []);
}
