'use client';

import { useMemo } from 'react';
import { getClientEnv, type ClientEnv } from '@/lib/utils/env';

export type Env = ClientEnv;

export function useEnv(): Env {
  return useMemo(() => {
    return getClientEnv();
  }, []);
}
