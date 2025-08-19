import { NextRequest, NextResponse } from 'next/server';

import { handleDeposit } from '@/lib/relayer/handlers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, erc20Address, ethereumAddress } = body ?? {};

    if (!userAddress || !erc20Address || !ethereumAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Run handleDeposit in the background
    handleDeposit({
      userAddress,
      erc20Address,
      ethereumAddress,
    })
      .then(result => {
        if (!result.ok) {
          console.error('[DEPOSIT] Background process failed:', result.error);
        } else {
          console.log('[DEPOSIT] Background process completed successfully');
        }
      })
      .catch(error => {
        console.error('[DEPOSIT] Background process error:', error);
      });

    // Return immediately with 202 Accepted
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
