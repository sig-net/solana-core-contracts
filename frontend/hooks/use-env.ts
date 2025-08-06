'use client';

import { useMemo } from 'react';
import { getClientEnv, type ClientEnv } from '@/lib/utils/env';

export function useEnv(): ClientEnv {
  return useMemo(() => {
    return getClientEnv();
  }, []);
}
