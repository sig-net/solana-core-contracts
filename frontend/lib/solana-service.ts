import {
  Connection,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';

import type { TokenBalance } from '@/components/balance-table';
import { IDL, type SolanaCoreContracts } from '@/lib/program/idl';
import {
  generateRequestId,
  createEvmTransactionParams,
  evmParamsToProgram,
  hexToBytes,
} from '@/lib/program/utils';

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
      const accounts = await this.connection.getProgramAccounts(PROGRAM_ID);

      if (accounts.length === 0) {
        return [];
      }

      const pendingDeposits = [];

      for (const account of accounts) {
        try {
          const accountData = account.account.data;
          const expectedDiscriminator = [214, 238, 68, 242, 98, 102, 251, 178];

          const accountDiscriminator = accountData.slice(0, 8);
          const isMatch = expectedDiscriminator.every(
            (byte, index) => accountDiscriminator[index] === byte,
          );

          if (isMatch) {
            const program = this.getProgram();
            if (program.account && program.account.pendingErc20Deposit) {
              const accountInfo =
                await program.account.pendingErc20Deposit.fetch(account.pubkey);

              if (accountInfo && accountInfo.requester.equals(publicKey)) {
                const requestId =
                  '0x' + Buffer.from(accountInfo.requestId).toString('hex');

                const erc20Address =
                  '0x' + Buffer.from(accountInfo.erc20Address).toString('hex');

                pendingDeposits.push({
                  requestId,
                  amount: accountInfo.amount.toString(),
                  erc20Address,
                  requester: accountInfo.requester.toString(),
                  pda: account.pubkey.toString(),
                });
              }
            }
          }
        } catch (error) {
          continue;
        }
      }

      return pendingDeposits;
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
        `https://sepolia.infura.io/v3/6df51ccaa17f4e078325b5050da5a2dd`,
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

      const [userBalancePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('user_erc20_balance'),
          publicKey.toBuffer(),
          Buffer.from(erc20AddressBytes),
        ],
        PROGRAM_ID,
      );

      const [chainSignaturesStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('program-state')],
        CHAIN_SIGNATURES_PROGRAM_ID,
      );

      const evmParams = evmParamsToProgram(txParams);

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

      return tx;
    } catch (error) {
      throw new Error(
        `Failed to deposit ERC20: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async waitForSignatureResponse(requestId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      let listener: number;
      const timeoutMs = 60000;

      listener = (this.getProgram() as any).addEventListener(
        'signatureRespondedEvent',
        async (event: any) => {
          try {
            const eventRequestIdHex =
              '0x' + Buffer.from(event.requestId).toString('hex');

            if (eventRequestIdHex !== requestId) {
              return;
            }

            (this.getProgram() as any).removeEventListener(listener);

            resolve(event.signature);
          } catch (error) {
            (this.getProgram() as any).removeEventListener(listener);
            reject(error);
          }
        },
      );

      setTimeout(() => {
        (this.getProgram() as any).removeEventListener(listener);
        reject(new Error('Timeout waiting for signature response'));
      }, timeoutMs);
    });
  }

  private async waitForReadResponse(requestId: string): Promise<{
    signature: any;
    serializedOutput: Buffer;
  }> {
    return new Promise((resolve, reject) => {
      let listener: number;
      const timeoutMs = 60000;

      listener = (this.getProgram() as any).addEventListener(
        'readRespondedEvent',
        async (event: any) => {
          try {
            const eventRequestIdHex =
              '0x' + Buffer.from(event.requestId).toString('hex');

            if (eventRequestIdHex !== requestId) {
              return;
            }

            (this.getProgram() as any).removeEventListener(listener);

            resolve({
              signature: event.signature,
              serializedOutput: Buffer.from(event.serializedOutput),
            });
          } catch (error) {
            (this.getProgram() as any).removeEventListener(listener);
            reject(error);
          }
        },
      );

      setTimeout(() => {
        (this.getProgram() as any).removeEventListener(listener);
        reject(new Error('Timeout waiting for read response'));
      }, timeoutMs);
    });
  }

  async claimErc20(publicKey: PublicKey, requestId: string): Promise<string> {
    try {
      const requestIdBytes = hexToBytes(requestId);

      const [pendingDepositPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pending_erc20_deposit'), Buffer.from(requestIdBytes)],
        PROGRAM_ID,
      );

      let realSignature: any;
      let realSerializedOutput: Buffer;

      try {
        const { signature, serializedOutput } =
          await this.waitForReadResponse(requestId);

        realSignature = signature;
        realSerializedOutput = serializedOutput;
      } catch (error) {
        throw new Error(
          `Failed to get signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
          realSerializedOutput,
          realSignature,
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
}
