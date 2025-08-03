import { Connection } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import type { Hex } from 'viem';

import { CHAIN_SIGNATURES_PROGRAM_IDl } from '../program/idl_chain_sig';
import type {
  ChainSignaturesProgram,
  ChainSignaturesSignature,
  SignatureRespondedEvent,
  ReadRespondedEvent,
  EventPromises,
} from '../types/chain-signatures.types';
import type { EthereumSignature } from '../types/ethereum.types';

/**
 * ChainSignaturesContract class handles all interactions with the chain signatures program,
 * including event listening, signature extraction, and log searching.
 */
export class ChainSignaturesContract {
  private connection: Connection;
  private wallet: Wallet;

  constructor(connection: Connection, wallet: Wallet) {
    this.connection = connection;
    this.wallet = wallet;
  }

  /**
   * Get the chain signatures program instance
   */
  getProgram(): ChainSignaturesProgram {
    const provider = new AnchorProvider(this.connection, this.wallet, {
      commitment: 'confirmed',
    });

    return new Program(
      CHAIN_SIGNATURES_PROGRAM_IDl,
      provider,
    ) as ChainSignaturesProgram;
  }

  /**
   * Setup event listeners for signature and read response events
   */
  setupEventListeners(requestId: string): EventPromises {
    let signatureResolve: (value: SignatureRespondedEvent) => void;
    let readRespondResolve: (value: ReadRespondedEvent) => void;

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
          signatureResolve(event);
        } else {
          throw new Error('Signature event request ID mismatch');
        }
      },
    );

    const readRespondListener = chainSignaturesProgram.addEventListener(
      'readRespondedEvent',
      (event: ReadRespondedEvent) => {
        const eventRequestId =
          '0x' + Buffer.from(event.requestId).toString('hex');

        if (eventRequestId === requestId) {
          readRespondResolve(event);
        } else {
          throw new Error('Signature event request ID mismatch');
        }
      },
    );

    const cleanup = () => {
      chainSignaturesProgram.removeEventListener(signatureListener);
      chainSignaturesProgram.removeEventListener(readRespondListener);
    };

    return {
      signature: signaturePromise,
      readRespond: readRespondPromise,
      cleanup,
    };
  }

  /**
   * Extract Ethereum signature from chain signatures signature
   */
  extractSignature(signature: ChainSignaturesSignature): EthereumSignature {
    const r = ('0x' + Buffer.from(signature.bigR.x).toString('hex')) as Hex;
    const s = ('0x' + Buffer.from(signature.s).toString('hex')) as Hex;
    const v = BigInt(signature.recoveryId + 27);

    return { r, s, v };
  }
}
