import { NextRequest, NextResponse } from 'next/server';

import { handleWithdrawal } from '@/lib/relayer/handlers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, erc20Address, transactionParams } = body ?? {};

    if (!requestId || !erc20Address || !transactionParams) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Run handleWithdrawal in the background
    handleWithdrawal({
      requestId,
      erc20Address,
      transactionParams,
    })
      .then(result => {
        if (!result.ok) {
          console.error(
            '[WITHDRAWAL] Background process failed:',
            result.error,
          );
        } else {
          console.log('[WITHDRAWAL] Background process completed successfully');
        }
      })
      .catch(error => {
        console.error('[WITHDRAWAL] Background process error:', error);
      });

    // Return immediately with 202 Accepted
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
