import { PublicKey } from '@solana/web3.js';

// Chain Signatures Program Types
export interface ChainSignaturesBigR {
  x: number[];
  y: number[];
}

export interface ChainSignaturesSignature {
  bigR: ChainSignaturesBigR;
  s: number[];
  recoveryId: number;
}

export interface SignatureRespondedEvent {
  requestId: number[];
  responder: PublicKey;
  signature: ChainSignaturesSignature;
}

export interface ReadRespondedEvent {
  requestId: number[];
  responder: PublicKey;
  serializedOutput: number[];
  signature: ChainSignaturesSignature;
}

// Event Listener Types
export interface EventPromises {
  signature: Promise<SignatureRespondedEvent>;
  readRespond: Promise<ReadRespondedEvent>;
  cleanup: () => void;
}

// Chain Signatures Program Interface
export interface ChainSignaturesProgram {
  programId: PublicKey;
  coder: {
    events: {
      decode(logMessage: string): {
        name: string;
        data: SignatureRespondedEvent | ReadRespondedEvent;
      } | null;
    };
  };
  addEventListener(
    eventName: 'signatureRespondedEvent',
    callback: (event: SignatureRespondedEvent) => void,
  ): unknown;
  addEventListener(
    eventName: 'readRespondedEvent',
    callback: (event: ReadRespondedEvent) => void,
  ): unknown;
  removeEventListener(listener: unknown): void;
}
