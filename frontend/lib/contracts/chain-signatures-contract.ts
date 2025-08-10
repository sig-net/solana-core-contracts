import { Connection } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import type { Hex } from 'viem';

import type {
  ChainSignaturesProgram,
  ChainSignaturesSignature,
  SignatureRespondedEvent,
  ReadRespondedEvent,
  EventPromises,
} from '../types/chain-signatures.types';
import { CHAIN_SIGNATURES_PROGRAM_IDl } from '../program/IDL_CHAIN_SIG';

export class ChainSignaturesContract {
  private connection: Connection;
  private wallet: Wallet;

  constructor(connection: Connection, wallet: Wallet) {
    this.connection = connection;
    this.wallet = wallet;
  }

  getProgram(): ChainSignaturesProgram {
    const provider = new AnchorProvider(this.connection, this.wallet, {
      commitment: 'confirmed',
    });

    return new Program(
      CHAIN_SIGNATURES_PROGRAM_IDl,
      provider,
    ) as ChainSignaturesProgram;
  }

  setupEventListeners(requestId: string): EventPromises {
    let signatureResolve: (value: SignatureRespondedEvent) => void;
    let readRespondResolve: (value: ReadRespondedEvent) => void;
    let resolvedSignature = false;
    let resolvedRead = false;
    // Timers are managed by the waiter per-event; initialize as null
    let backfillSignatureTimer: ReturnType<typeof setTimeout> | null = null;
    let backfillReadTimer: ReturnType<typeof setTimeout> | null = null;

    const signaturePromise = new Promise<SignatureRespondedEvent>(resolve => {
      signatureResolve = resolve;
    });

    const readRespondPromise = new Promise<ReadRespondedEvent>(resolve => {
      readRespondResolve = resolve;
    });

    const chainSignaturesProgram = this.getProgram();

    const signatureListener = chainSignaturesProgram.addEventListener(
      'signatureRespondedEvent',
      (event: SignatureRespondedEvent) => {
        const eventRequestId =
          '0x' + Buffer.from(event.requestId).toString('hex');

        if (eventRequestId === requestId) {
          if (!resolvedSignature) {
            resolvedSignature = true;
            signatureResolve(event);
            if (resolvedSignature && resolvedRead) {
              if (backfillSignatureTimer) {
                clearTimeout(backfillSignatureTimer);
                backfillSignatureTimer = null;
              }
              if (backfillReadTimer) {
                clearTimeout(backfillReadTimer);
                backfillReadTimer = null;
              }
            }
          }
        } else {
          console.warn('Signature event request ID mismatch');
        }
      },
    );

    const readRespondListener = chainSignaturesProgram.addEventListener(
      'readRespondedEvent',
      (event: ReadRespondedEvent) => {
        const eventRequestId =
          '0x' + Buffer.from(event.requestId).toString('hex');

        if (eventRequestId === requestId) {
          if (!resolvedRead) {
            resolvedRead = true;
            readRespondResolve(event);
            if (resolvedSignature && resolvedRead) {
              if (backfillSignatureTimer) {
                clearTimeout(backfillSignatureTimer);
                backfillSignatureTimer = null;
              }
              if (backfillReadTimer) {
                clearTimeout(backfillReadTimer);
                backfillReadTimer = null;
              }
            }
          }
        } else {
          console.warn('Signature event request ID mismatch');
        }
      },
    );

    const cleanup = () => {
      chainSignaturesProgram.removeEventListener(signatureListener);
      chainSignaturesProgram.removeEventListener(readRespondListener);
      if (backfillSignatureTimer) {
        clearTimeout(backfillSignatureTimer);
        backfillSignatureTimer = null;
      }
      if (backfillReadTimer) {
        clearTimeout(backfillReadTimer);
        backfillReadTimer = null;
      }
    };

    const backfillSignature = async () => {
      if (resolvedSignature) return;
      await this.tryBackfillEvents(
        requestId,
        sig => {
          if (!resolvedSignature) {
            resolvedSignature = true;
            signatureResolve(sig);
          }
        },
        () => {},
      );
    };

    const backfillRead = async () => {
      if (resolvedRead) return;
      await this.tryBackfillEvents(
        requestId,
        () => {},
        read => {
          if (!resolvedRead) {
            resolvedRead = true;
            readRespondResolve(read);
          }
        },
      );
    };

    return {
      signature: signaturePromise,
      readRespond: readRespondPromise,
      cleanup,
      backfillSignature,
      backfillRead,
    };
  }

  static extractSignature(signature: ChainSignaturesSignature) {
    const r = ('0x' + Buffer.from(signature.bigR.x).toString('hex')) as Hex;
    const s = ('0x' + Buffer.from(signature.s).toString('hex')) as Hex;
    const v = BigInt(signature.recoveryId + 27);

    return { r, s, v };
  }

  private async tryBackfillEvents(
    requestId: string,
    onSignature: (event: SignatureRespondedEvent) => void,
    onReadRespond: (event: ReadRespondedEvent) => void,
    maxSignatures = 100,
  ): Promise<void> {
    try {
      const program = this.getProgram();
      const programId = program.programId;
      const signatures = await this.connection.getSignaturesForAddress(
        programId,
        { limit: maxSignatures },
      );

      for (const sig of signatures) {
        try {
          const tx = await this.connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });
          const logs = tx?.meta?.logMessages ?? [];
          for (const log of logs) {
            try {
              const decoded = program.coder.events.decode(log) as {
                name: string;
                data: SignatureRespondedEvent | ReadRespondedEvent;
              } | null;
              if (!decoded) continue;
              const name = decoded.name as string;
              if (
                name === 'signatureRespondedEvent' ||
                name === 'readRespondedEvent'
              ) {
                const eventReq =
                  '0x' + Buffer.from(decoded.data.requestId).toString('hex');
                if (eventReq !== requestId) continue;
                if (name === 'signatureRespondedEvent') {
                  onSignature(decoded.data as SignatureRespondedEvent);
                } else if (name === 'readRespondedEvent') {
                  onReadRespond(decoded.data as ReadRespondedEvent);
                }
              }
            } catch {
              // ignore decode errors per-log
            }
          }
        } catch {
          // ignore tx fetch errors
        }
      }
    } catch {
      // ignore overall backfill errors
    }
  }
}
