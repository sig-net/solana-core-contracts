import {
  Connection,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import * as borsh from 'borsh';

import type { TokenBalance } from '@/components/balance-table';
import { IDL, type SolanaCoreContracts } from '@/lib/program/idl';
import {
  generateRequestId,
  createEvmTransactionParams,
  evmParamsToProgram,
  hexToBytes,
} from '@/lib/program/utils';
import { CHAIN_SIGNATURES_PROGRAM_IDl } from './program/idl_chain_sig';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

const CONFIG = {
  BASE_PUBLIC_KEY:
    '0x044eef776e4f257d68983e45b340c2e9546c5df95447900b6aadfec68fb46fdee257e26b8ba383ddba9914b33c60e869265f859566fff4baef283c54d821ca3b64',
  EPSILON_DERIVATION_PREFIX: 'sig.network v1.0.0 epsilon derivation',
  SOLANA_CHAIN_ID: '0x800001f5',
};

const PROGRAM_ID = new PublicKey(
  'GDMMWC3YiZEffb2u5dw6FTLRY5wV5vAcXP72LRAJaVhK',
);

const CHAIN_SIGNATURES_PROGRAM_ID = new PublicKey(
  '4uvZW8K4g4jBg7dzPNbb9XDxJLFBK7V6iC76uofmYvEU',
);

const INFURA_API_KEY =
  process.env.NEXT_PUBLIC_INFURA_API_KEY || '6df51ccaa17f4e078325b5050da5a2dd';
const ETHEREUM_PRIVATE_KEY = process.env.ETHEREUM_PRIVATE_KEY || '';

function deriveEpsilon(requester: string, path: string): bigint {
  const derivationPath = `${CONFIG.EPSILON_DERIVATION_PREFIX},${CONFIG.SOLANA_CHAIN_ID},${requester},${path}`;
  const hash = ethers.keccak256(ethers.toUtf8Bytes(derivationPath));
  return BigInt(hash);
}

function publicKeyToPoint(publicKey: string): { x: bigint; y: bigint } {
  const cleanPubKey = publicKey.slice(4);
  const x = cleanPubKey.slice(0, 64);
  const y = cleanPubKey.slice(64, 128);
  return {
    x: BigInt('0x' + x),
    y: BigInt('0x' + y),
  };
}

function pointToPublicKey(point: { x: bigint; y: bigint }): string {
  const x = point.x.toString(16).padStart(64, '0');
  const y = point.y.toString(16).padStart(64, '0');
  return '0x04' + x + y;
}

function derivePublicKey(
  path: string,
  requesterAddress: string,
  basePublicKey: string,
): string {
  try {
    const epsilon = deriveEpsilon(requesterAddress, path);
    const basePoint = publicKeyToPoint(basePublicKey);

    const epsilonPoint = secp256k1.ProjectivePoint.BASE.multiply(epsilon);

    const baseProjectivePoint = new secp256k1.ProjectivePoint(
      basePoint.x,
      basePoint.y,
      BigInt(1),
    );

    const resultPoint = epsilonPoint.add(baseProjectivePoint);
    const resultAffine = resultPoint.toAffine();

    const derivedPublicKey = pointToPublicKey({
      x: resultAffine.x,
      y: resultAffine.y,
    });

    return derivedPublicKey;
  } catch (error) {
    throw error;
  }
}

export class SolanaService {
  private program: Program<SolanaCoreContracts> | null = null;

  constructor(
    private connection: Connection,
    private wallet?: any,
  ) {}

  private getProgram(): Program<SolanaCoreContracts> {
    if (!this.program) {
      const provider = new AnchorProvider(
        this.connection,
        this.wallet || {
          publicKey: PublicKey.default,
          signTransaction: async () => {
            throw new Error('No wallet');
          },
          signAllTransactions: async () => {
            throw new Error('No wallet');
          },
        },
        { commitment: 'confirmed' },
      );

      this.program = new Program(IDL, provider);
    }
    return this.program;
  }

  private getChainSigProgram(): Program<any> {
    const provider = new AnchorProvider(
      this.connection,
      this.wallet || {
        publicKey: PublicKey.default,
        signTransaction: async () => {
          throw new Error('No wallet');
        },
        signAllTransactions: async () => {
          throw new Error('No wallet');
        },
      },
      { commitment: 'confirmed' },
    );

    return new Program(CHAIN_SIGNATURES_PROGRAM_IDl, provider);
  }

  setWallet(wallet: any) {
    this.wallet = wallet;
    this.program = null;
  }

  async deriveDepositAddress(publicKey: PublicKey): Promise<string> {
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault_authority'), publicKey.toBuffer()],
      PROGRAM_ID,
    );

    const path = publicKey.toString();
    const derivedPublicKey = derivePublicKey(
      path,
      vaultAuthority.toString(),
      CONFIG.BASE_PUBLIC_KEY,
    );

    const derivedAddress = ethers.computeAddress(derivedPublicKey);

    return derivedAddress;
  }

  async fetchPendingDeposits(publicKey: PublicKey): Promise<
    Array<{
      requestId: string;
      amount: string;
      erc20Address: string;
      requester: string;
      pda: string;
    }>
  > {
    try {
      const pendingDeposits =
        await this.getProgram().account.pendingErc20Deposit.all([
          {
            memcmp: {
              offset: 8,
              bytes: publicKey.toBase58(),
            },
          },
        ]);

      return pendingDeposits.map(({ account, publicKey: pda }) => ({
        requestId: '0x' + Buffer.from(account.requestId).toString('hex'),
        amount: account.amount.toString(),
        erc20Address: '0x' + Buffer.from(account.erc20Address).toString('hex'),
        requester: account.requester.toString(),
        pda: pda.toString(),
      }));
    } catch (error) {
      return [];
    }
  }

  async fetchUserBalances(publicKey: PublicKey): Promise<TokenBalance[]> {
    try {
      const commonErc20Addresses = [
        '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC Sepolia
        '0xbe72e441bf55620febc26715db68d3494213d8cb', // USDC Sepolia
        '0x58eb19ef91e8a6327fed391b51ae1887b833cc91', // USDT Sepolia
      ];

      const balancesPromises = commonErc20Addresses.map(async erc20Address => {
        const balance = await this.fetchUserBalance(publicKey, erc20Address);
        if (balance !== '0') {
          return {
            erc20Address,
            amount: balance,
          };
        }
        return null;
      });

      const results = await Promise.all(balancesPromises);
      return results.filter(
        (result): result is TokenBalance => result !== null,
      );
    } catch (error) {
      throw new Error(
        `Failed to fetch user balances: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async fetchUserBalance(
    publicKey: PublicKey,
    erc20Address: string,
  ): Promise<string> {
    try {
      const erc20Bytes = Buffer.from(erc20Address.replace('0x', ''), 'hex');

      const [userBalancePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_erc20_balance'), publicKey.toBuffer(), erc20Bytes],
        PROGRAM_ID,
      );

      const accountInfo = await this.connection.getAccountInfo(userBalancePda);

      if (!accountInfo) {
        return '0';
      }

      if (!accountInfo.owner.equals(PROGRAM_ID)) {
        throw new Error('Account is not owned by the expected program');
      }

      const data = accountInfo.data;
      const amountBytes = data.subarray(8, 24);
      let amount = BigInt(0);

      for (let i = 0; i < 16; i++) {
        amount |= BigInt(amountBytes[i]) << BigInt(i * 8);
      }

      return amount.toString();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Account does not exist')
      ) {
        return '0';
      }
      throw new Error(
        `Failed to fetch user balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async depositErc20(
    publicKey: PublicKey,
    erc20Address: string,
    amount: string,
    decimals = 6,
  ): Promise<string> {
    try {
      const amountBigInt = ethers.parseUnits(amount, decimals);
      const amountBN = new BN(amountBigInt.toString(), 10);

      const [vaultAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault_authority'), publicKey.toBuffer()],
        PROGRAM_ID,
      );

      const path = publicKey.toString();
      const derivedPublicKey = derivePublicKey(
        path,
        vaultAuthority.toString(),
        CONFIG.BASE_PUBLIC_KEY,
      );
      const derivedAddress = ethers.computeAddress(derivedPublicKey);

      const hardcodedRecipient = '0x041477de8ecbcf633cb13ea10aa86cdf4d437c29';
      const erc20AddressBytes = Array.from(
        Buffer.from(erc20Address.slice(2), 'hex'),
      );

      const transferInterface = new ethers.Interface([
        'function transfer(address to, uint256 amount) returns (bool)',
      ]);
      const callData = transferInterface.encodeFunctionData('transfer', [
        hardcodedRecipient,
        amountBigInt,
      ]);

      const provider = new ethers.JsonRpcProvider(
        `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      );
      const currentNonce = await provider.getTransactionCount(derivedAddress);

      const txParams = createEvmTransactionParams(currentNonce);

      const tempTx = {
        type: 2,
        chainId: 11155111,
        nonce: currentNonce,
        maxPriorityFeePerGas: txParams.maxPriorityFeePerGas,
        maxFeePerGas: txParams.maxFeePerGas,
        gasLimit: txParams.gasLimit,
        to: erc20Address,
        value: BigInt(0),
        data: callData,
      };

      const rlpEncodedTx = ethers.Transaction.from(tempTx).unsignedSerialized;

      const requestId = generateRequestId(
        vaultAuthority,
        ethers.getBytes(rlpEncodedTx),
        60,
        0,
        path,
        'ECDSA',
        'ethereum',
        '',
      );

      const requestIdBytes = Array.from(Buffer.from(requestId.slice(2), 'hex'));

      const [pendingDepositPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pending_erc20_deposit'), Buffer.from(requestIdBytes)],
        PROGRAM_ID,
      );

      const existingPendingDeposit =
        await this.connection.getAccountInfo(pendingDepositPda);
      if (existingPendingDeposit) {
        throw new Error(
          `A pending deposit already exists for this request. Please wait for it to be processed or use a different transaction.`,
        );
      }

      const [chainSignaturesStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('program-state')],
        CHAIN_SIGNATURES_PROGRAM_ID,
      );

      const evmParams = evmParamsToProgram(txParams);

      // Step 3: Setup event listeners BEFORE calling depositErc20
      console.log('Setting up event listeners for request:', requestId);
      const eventPromises = this.setupEventListeners(requestId);

      // Step 4: Call depositErc20 on Solana
      console.log('Calling depositErc20 on Solana...');
      const tx = await this.getProgram()
        .methods.depositErc20(
          requestIdBytes,
          erc20AddressBytes,
          amountBN,
          evmParams,
        )
        .accounts({
          authority: publicKey,
          requester: vaultAuthority,
          pendingDeposit: pendingDepositPda,
          feePayer: publicKey,
          chainSignaturesState: chainSignaturesStatePda,
          chainSignaturesProgram: CHAIN_SIGNATURES_PROGRAM_ID,
          systemProgram: new PublicKey('11111111111111111111111111111111'),
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
        } as any)
        .rpc();

      console.log('Deposit transaction submitted:', tx);

      // Step 5: Process the flow following the exact pattern from the README
      this.processDepositFlow(
        requestId,
        tempTx,
        callData,
        eventPromises,
        provider,
        currentNonce,
        txParams,
      ).catch(error => {
        console.error('Error in deposit flow:', error);
        // Store error status for UI
        this.storeDepositStatus(requestId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

      return requestId;
    } catch (error) {
      throw new Error(
        `Failed to deposit ERC20: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async claimErc20(publicKey: PublicKey, requestId: string): Promise<string> {
    try {
      const requestIdBytes = hexToBytes(requestId);

      const [pendingDepositPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pending_erc20_deposit'), Buffer.from(requestIdBytes)],
        PROGRAM_ID,
      );

      // Check if the deposit is ready to be claimed
      const depositStatus = await this.checkDepositStatus(requestId);
      if (!depositStatus.isReady) {
        throw new Error(
          `Deposit not ready to claim. Status: ${depositStatus.status}`,
        );
      }

      let pendingDeposit;
      try {
        pendingDeposit =
          await this.getProgram().account.pendingErc20Deposit.fetch(
            pendingDepositPda,
          );
      } catch (error) {
        const accountInfo =
          await this.connection.getAccountInfo(pendingDepositPda);

        throw new Error(
          `No pending deposit found for request ID ${requestId}. Make sure you have successfully deposited ERC20 tokens first.`,
        );
      }

      const [userBalancePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('user_erc20_balance'),
          publicKey.toBuffer(),
          Buffer.from(pendingDeposit.erc20Address),
        ],
        PROGRAM_ID,
      );

      const tx = await this.getProgram()
        .methods.claimErc20(
          Array.from(requestIdBytes),
          depositStatus.serializedOutput!,
          depositStatus.signature!,
        )
        .accounts({
          authority: publicKey,
          pendingDeposit: pendingDepositPda,
          userBalance: userBalancePda,
          systemProgram: new PublicKey('11111111111111111111111111111111'),
        } as any)
        .rpc();

      return tx;
    } catch (error) {
      throw new Error(
        `Failed to claim ERC20: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async withdraw(
    publicKey: PublicKey,
    erc20Address: string,
    amount: string,
  ): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));

    throw new Error('Withdraw functionality not yet implemented');
  }

  async getRawTransactionFromPreviousDeposit(requestId: string): Promise<{
    unsignedTx: any;
    callData: string;
    nonce: number;
    txParams: any;
    signature?: any;
  } | null> {
    // Get recent transactions for the Chain Signatures Program
    const chainSigProgram = this.getChainSigProgram();
    const signaturesChainSig = await this.connection.getSignaturesForAddress(
      chainSigProgram.programId,
      {
        limit: 50, // Look at last 50 transactions
      },
    );

    // Search through transactions to find the one with our request ID
    for (const signatureInfo of signaturesChainSig) {
      console.log('🔍 Processing signature:', signatureInfo.signature);
      const tx = await this.connection.getTransaction(signatureInfo.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      let signature = null;
      for (const log of tx?.meta?.logMessages || []) {
        try {
          const logMessage = log.split(':')[1].trim();
          const decoded = chainSigProgram.coder.events.decode(logMessage);

          if (decoded && decoded.name === 'signatureRespondedEvent') {
            const eventData = decoded.data as {
              requestId: number[];
              responder: PublicKey;
              signature: {
                bigR: {
                  x: number[];
                  y: number[];
                };
                s: number[];
                recoveryId: number;
              };
            };

            const requestIdBytes = Buffer.from(
              requestId.replace('0x', ''),
              'hex',
            );
            const eventRequestIdBytes = Buffer.from(eventData.requestId);

            if (requestIdBytes.equals(eventRequestIdBytes)) {
              console.log('🔍 Found matching request ID:', requestId);
              console.log('🔍 Event data:', eventData);
              signature = eventData.signature;
              break;
            }
          }
        } catch {}
      }

      if (signature) {
        break;
      }

      continue;
    }

    let originalTx = null;
    const program = this.getProgram();
    const signaturesProgram = await this.connection.getSignaturesForAddress(
      program.programId,
      {
        limit: 10,
      },
    );

    for (const signatureInfo of signaturesProgram) {
      const tx = await program.provider.connection.getParsedTransaction(
        signatureInfo.signature,
        {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        },
      );

      for (const instruction of tx?.transaction.message.instructions || []) {
        const DepositErc20Schema = {
          struct: {
            requestId: { array: { type: 'u8', len: 32 } },
            erc20Address: { array: { type: 'u8', len: 20 } },
            amount: 'u128',
            txParams: {
              struct: {
                value: 'u128',
                gasLimit: 'u128',
                maxFeePerGas: 'u128',
                maxPriorityFeePerGas: 'u128',
                nonce: 'u64',
                chainId: 'u64',
              },
            },
          },
        };

        console.log('instruction', instruction);

        try {
          if (!('data' in instruction)) {
            continue;
          }

          const instructionBuffer = bs58.decode(instruction.data);
          const dataWithoutDiscriminator = instructionBuffer.slice(8);
          const decodedInstruction = borsh.deserialize(
            DepositErc20Schema,
            dataWithoutDiscriminator,
          ) as {
            requestId: number[];
            erc20Address: number[];
            amount: bigint;
            txParams: {
              value: bigint;
              gasLimit: bigint;
              maxFeePerGas: bigint;
              maxPriorityFeePerGas: bigint;
              nonce: bigint;
              chainId: bigint;
            };
          };

          if (!decodedInstruction) {
            continue;
          }

          console.log('decodedInstruction', decodedInstruction);

          const requestIdBytes = Buffer.from(
            requestId.replace('0x', ''),
            'hex',
          );

          const eventRequestIdBytes = Buffer.from(decodedInstruction.requestId);

          if (eventRequestIdBytes.equals(requestIdBytes)) {
            originalTx = decodedInstruction.txParams;
            console.log('originalTx', originalTx);
            break;
            // // Return the decoded instruction data
            // return {
            //   requestId: requestIdHex,
            //   erc20Address: erc20AddressHex,
            //   amount: decodedInstruction.amount,
            //   txParams: decodedInstruction.txParams,
            //   signature: null, // Will be populated if signature is found
            //   unsignedTx: {
            //     to: erc20AddressHex,
            //     value: decodedInstruction.txParams.value,
            //     gasLimit: decodedInstruction.txParams.gasLimit,
            //     maxFeePerGas: decodedInstruction.txParams.maxFeePerGas,
            //     maxPriorityFeePerGas:
            //       decodedInstruction.txParams.maxPriorityFeePerGas,
            //     nonce: decodedInstruction.txParams.nonce,
            //     chainId: decodedInstruction.txParams.chainId,
            //   },
            // };
          }
        } catch (decodeError) {
          continue;
        }
      }
      if (originalTx) {
        break;
      }
    }

    throw new Error('No matching transaction found');
  }

  async submitSignedTransactionFromPrevious(
    requestId: string,
  ): Promise<string> {
    try {
      console.log(
        '📡 Submitting signed transaction from previous deposit for:',
        requestId,
      );

      // Get the raw transaction data from previous deposit
      const txData = await this.getRawTransactionFromPreviousDeposit(requestId);
      if (!txData) {
        throw new Error(
          'Could not find previous transaction data for this request',
        );
      }

      let signatureEvent;
      let eventPromises: any = null;

      // Check if we already have the signature from the previous transaction
      if (txData.signature) {
        console.log('✅ Using signature from previous transaction');
        signatureEvent = { signature: txData.signature };
      } else {
        // Wait for signature event from Chain Signatures Program
        eventPromises = this.setupEventListeners(requestId);

        console.log('⏳ Waiting for signature event...');
        signatureEvent = await eventPromises.signature;
        console.log('✅ Signature received!');
      }

      const signature = this.extractSignature(signatureEvent.signature);

      // Create signed transaction using the retrieved data
      const signedTx = ethers.Transaction.from({
        ...txData.unsignedTx,
        signature,
      });

      // Submit to Ethereum
      const provider = new ethers.JsonRpcProvider(
        `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      );

      console.log('📡 Submitting transaction to Ethereum...');
      const txHash = await provider.send('eth_sendRawTransaction', [
        signedTx.serialized,
      ]);
      console.log('✅ Transaction submitted with hash:', txHash);

      // Wait for confirmation
      console.log('⏳ Waiting for Ethereum confirmation...');
      const receipt = await provider.waitForTransaction(txHash, 1);
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      console.log(
        '✅ Ethereum transaction confirmed in block:',
        receipt.blockNumber,
      );

      // Store the transaction info for status checking
      this.storeDepositStatus(requestId, {
        status: 'confirming_ethereum',
        txHash,
        blockNumber: receipt.blockNumber,
      });

      // Wait for read response only if we have event listeners
      if (eventPromises) {
        console.log('⏳ Waiting for read response...');
        const readEvent = await eventPromises.readRespond;
        console.log('✅ Read response received!');

        // Store final status for claiming
        this.storeDepositStatus(requestId, {
          status: 'ready_to_claim',
          txHash,
          blockNumber: receipt.blockNumber,
          signature: readEvent.signature,
          serializedOutput: Buffer.from(readEvent.serializedOutput),
        });

        // Cleanup
        eventPromises.cleanup();
      } else {
        // If we used existing signature, we still need to wait for read response
        console.log('⏳ Setting up read response listener...');
        const readEventPromises = this.setupEventListeners(requestId);
        const readEvent = await readEventPromises.readRespond;
        console.log('✅ Read response received!');

        // Store final status for claiming
        this.storeDepositStatus(requestId, {
          status: 'ready_to_claim',
          txHash,
          blockNumber: receipt.blockNumber,
          signature: readEvent.signature,
          serializedOutput: Buffer.from(readEvent.serializedOutput),
        });

        // Cleanup
        readEventPromises.cleanup();
      }

      return txHash;
    } catch (error) {
      console.error('❌ Error submitting signed transaction:', error);
      throw new Error(
        `Failed to submit signed transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private setupEventListeners(requestId: string): {
    signature: Promise<any>;
    readRespond: Promise<any>;
    cleanup: () => void;
  } {
    let signatureResolve: (value: any) => void;
    let signatureReject: (reason?: any) => void;
    let readRespondResolve: (value: any) => void;
    let readRespondReject: (reason?: any) => void;

    const signaturePromise = new Promise((resolve, reject) => {
      signatureResolve = resolve;
      signatureReject = reject;
    });

    const readRespondPromise = new Promise((resolve, reject) => {
      readRespondResolve = resolve;
      readRespondReject = reject;
    });

    // Create Chain Signatures Program instance for event listening
    const chainSignaturesProvider = new AnchorProvider(
      this.connection,
      this.wallet || {
        publicKey: PublicKey.default,
        signTransaction: async () => {
          throw new Error('No wallet');
        },
        signAllTransactions: async () => {
          throw new Error('No wallet');
        },
      },
      { commitment: 'confirmed' },
    );

    // Import the chain signatures IDL
    const chainSignaturesProgram = new Program(
      // We need to use a minimal IDL for chain signatures events
      {
        version: '0.1.0',
        name: 'chain_signatures',
        instructions: [],
        events: [
          {
            name: 'signatureRespondedEvent',
            fields: [
              { name: 'requestId', type: 'bytes' },
              { name: 'signature', type: 'bytes' },
            ],
          },
          {
            name: 'readRespondedEvent',
            fields: [
              { name: 'requestId', type: 'bytes' },
              { name: 'signature', type: 'bytes' },
              { name: 'serializedOutput', type: 'bytes' },
            ],
          },
        ],
      } as any,
      chainSignaturesProvider,
    );

    // Setup signature event listener on Chain Signatures Program
    const signatureListener = (chainSignaturesProgram as any).addEventListener(
      'signatureRespondedEvent',
      (event: any) => {
        const eventRequestId =
          '0x' + Buffer.from(event.requestId).toString('hex');
        if (eventRequestId === requestId) {
          console.log('✅ Signature event received for request:', requestId);
          signatureResolve(event);
        }
      },
    );

    // Setup read respond event listener on Chain Signatures Program
    const readRespondListener = (
      chainSignaturesProgram as any
    ).addEventListener('readRespondedEvent', (event: any) => {
      const eventRequestId =
        '0x' + Buffer.from(event.requestId).toString('hex');
      if (eventRequestId === requestId) {
        console.log('✅ Read respond event received for request:', requestId);
        readRespondResolve(event);
      }
    });

    // Setup timeouts
    const signatureTimeout = setTimeout(() => {
      signatureReject(new Error('Signature timeout'));
    }, 120000); // 2 minutes

    const readRespondTimeout = setTimeout(() => {
      readRespondReject(new Error('Read response timeout'));
    }, 300000); // 5 minutes

    const cleanup = () => {
      clearTimeout(signatureTimeout);
      clearTimeout(readRespondTimeout);
      (chainSignaturesProgram as any).removeEventListener(signatureListener);
      (chainSignaturesProgram as any).removeEventListener(readRespondListener);
    };

    return {
      signature: signaturePromise,
      readRespond: readRespondPromise,
      cleanup,
    };
  }

  private async processDepositFlow(
    requestId: string,
    unsignedTx: any,
    callData: string,
    eventPromises: {
      signature: Promise<any>;
      readRespond: Promise<any>;
      cleanup: () => void;
    },
    provider: ethers.JsonRpcProvider,
    nonce: number,
    txParams: any,
  ): Promise<void> {
    try {
      console.log('🔄 Starting deposit flow for request:', requestId);

      // Step 5: Wait for signature from MPC network
      console.log('⏳ Waiting for signature from MPC network...');
      this.storeDepositStatus(requestId, { status: 'waiting_signature' });

      const signatureEvent = await eventPromises.signature;
      console.log('✅ Signature received!');

      const signature = this.extractSignature(signatureEvent.signature);

      // Step 6: Construct signed Ethereum transaction
      console.log('🔧 Constructing signed transaction...');
      const signedTx = ethers.Transaction.from({
        type: 2,
        chainId: 11155111,
        nonce,
        maxPriorityFeePerGas: BigInt(txParams.maxPriorityFeePerGas.toString()),
        maxFeePerGas: BigInt(txParams.maxFeePerGas.toString()),
        gasLimit: BigInt(txParams.gasLimit.toString()),
        to: unsignedTx.to,
        value: BigInt(0),
        data: callData,
        signature,
      });

      // Step 7: Submit to Ethereum network
      console.log('📡 Submitting transaction to Ethereum...');
      this.storeDepositStatus(requestId, { status: 'submitting_ethereum' });

      const txHash = await provider.send('eth_sendRawTransaction', [
        signedTx.serialized,
      ]);
      console.log('✅ Transaction submitted with hash:', txHash);

      // Step 8: Wait for Ethereum confirmation
      console.log('⏳ Waiting for Ethereum confirmation...');
      this.storeDepositStatus(requestId, {
        status: 'confirming_ethereum',
        txHash,
      });

      const receipt = await provider.waitForTransaction(txHash, 1);
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      console.log(
        '✅ Ethereum transaction confirmed in block:',
        receipt.blockNumber,
      );
      console.log(
        'Transaction status:',
        receipt.status === 1 ? 'Success' : 'Failed',
      );

      // Step 9: Wait for read response from MPC network
      console.log('⏳ Waiting for read response from MPC network...');
      this.storeDepositStatus(requestId, {
        status: 'waiting_read_response',
        txHash,
        blockNumber: receipt.blockNumber,
      });

      const readEvent = await eventPromises.readRespond;
      console.log('✅ Read response received!');

      // Step 10: Store final status for claiming
      this.storeDepositStatus(requestId, {
        status: 'ready_to_claim',
        txHash,
        blockNumber: receipt.blockNumber,
        signature: readEvent.signature,
        serializedOutput: Buffer.from(readEvent.serializedOutput),
      });

      console.log(
        '🎉 Deposit flow completed successfully for request:',
        requestId,
      );
    } catch (error) {
      console.error('❌ Error in deposit flow:', error);
      this.storeDepositStatus(requestId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      // Always cleanup event listeners
      eventPromises.cleanup();
    }
  }

  private extractSignature(signature: any): {
    r: string;
    s: string;
    v: bigint;
  } {
    const r = '0x' + Buffer.from(signature.bigR.x).toString('hex');
    const s = '0x' + Buffer.from(signature.s).toString('hex');
    const v = BigInt(signature.recoveryId + 27);

    return { r, s, v };
  }

  private depositStatusMap = new Map<string, any>();

  private storeDepositStatus(requestId: string, status: any): void {
    this.depositStatusMap.set(requestId, status);
  }

  async checkDepositStatus(requestId: string): Promise<{
    isReady: boolean;
    status: string;
    signature?: any;
    serializedOutput?: Buffer;
    txHash?: string;
    blockNumber?: number;
  }> {
    // Check if we have a stored status
    const storedStatus = this.depositStatusMap.get(requestId);

    if (storedStatus && storedStatus.status === 'ready_to_claim') {
      return {
        isReady: true,
        status: 'ready_to_claim',
        signature: storedStatus.signature,
        serializedOutput: storedStatus.serializedOutput,
        txHash: storedStatus.txHash,
        blockNumber: storedStatus.blockNumber,
      };
    }

    return {
      isReady: false,
      status: storedStatus?.status || 'pending',
      txHash: storedStatus?.txHash,
      blockNumber: storedStatus?.blockNumber,
    };
  }
}
