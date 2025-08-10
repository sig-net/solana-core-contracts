'use client';

import { getClientEnv, type ClientEnv } from '@/lib/utils/env';

export function useEnv(): ClientEnv {
  return getClientEnv();
}
