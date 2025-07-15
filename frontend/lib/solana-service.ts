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
  createMockSignature,
  createMockSerializedOutput,
} from '@/lib/program/utils';

// Constants from the test file
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

// Helper functions matching the test file
function deriveEpsilon(requester: string, path: string): bigint {
  const derivationPath = `${CONFIG.EPSILON_DERIVATION_PREFIX},${CONFIG.SOLANA_CHAIN_ID},${requester},${path}`;
  console.log('📝 Derivation path:', derivationPath);
  const hash = ethers.keccak256(ethers.toUtf8Bytes(derivationPath));
  return BigInt(hash);
}

function publicKeyToPoint(publicKey: string): { x: bigint; y: bigint } {
  const cleanPubKey = publicKey.slice(4); // Remove 0x04 prefix
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

    // Calculate epsilon * G
    const epsilonPoint = secp256k1.ProjectivePoint.BASE.multiply(epsilon);

    // Convert base point to projective
    const baseProjectivePoint = new secp256k1.ProjectivePoint(
      basePoint.x,
      basePoint.y,
      BigInt(1),
    );

    // Add points: result = base + epsilon * G
    const resultPoint = epsilonPoint.add(baseProjectivePoint);
    const resultAffine = resultPoint.toAffine();

    const derivedPublicKey = pointToPublicKey({
      x: resultAffine.x,
      y: resultAffine.y,
    });

    console.log('🔑 Derived public key:', derivedPublicKey);
    return derivedPublicKey;
  } catch (error) {
    console.error('❌ Error deriving public key:', error);
    throw error;
  }
}

export class SolanaService {
  private program: Program<SolanaCoreContracts> | null = null;

  constructor(
    private connection: Connection,
    private wallet?: any,
  ) {
    // Don't create the program immediately to avoid issues during static generation
  }

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
    this.program = null; // Reset program so it gets recreated with new wallet
  }

  async deriveDepositAddress(publicKey: PublicKey): Promise<string> {
    // Derive the user's Ethereum address from their Solana public key
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

    console.log('👛 Solana wallet:', publicKey.toString());
    console.log('📂 Path:', path);
    console.log('🔑 Derived Ethereum address:', derivedAddress);

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
      console.log(
        '🔍 Fetching pending deposits for user:',
        publicKey.toString(),
      );

      // Get all program accounts (remove dataSize filter for now to catch all accounts)
      const accounts = await this.connection.getProgramAccounts(PROGRAM_ID);

      console.log('📦 Found', accounts.length, 'program accounts');

      const pendingDeposits = [];

      for (const account of accounts) {
        try {
          // Check if this account has the PendingErc20Deposit discriminator
          const accountData = account.account.data;
          const expectedDiscriminator = [214, 238, 68, 242, 98, 102, 251, 178];

          // Check if first 8 bytes match the discriminator
          const accountDiscriminator = accountData.slice(0, 8);
          const isMatch = expectedDiscriminator.every(
            (byte, index) => accountDiscriminator[index] === byte,
          );

          if (isMatch) {
            console.log(
              '🔍 Found matching discriminator for:',
              account.pubkey.toString(),
            );

            // Try to decode as PendingErc20Deposit using the program
            const program = this.getProgram();
            if (program.account && program.account.pendingErc20Deposit) {
              const accountInfo =
                await program.account.pendingErc20Deposit.fetch(account.pubkey);

              console.log('🔍 Checking account:', account.pubkey.toString());
              console.log(
                '👤 Account requester:',
                accountInfo.requester.toString(),
              );
              console.log('👤 Our user:', publicKey.toString());

              if (accountInfo && accountInfo.requester.equals(publicKey)) {
                // Convert the request ID from bytes to hex string
                const requestId =
                  '0x' + Buffer.from(accountInfo.requestId).toString('hex');
                // Convert ERC20 address from bytes to hex string
                const erc20Address =
                  '0x' + Buffer.from(accountInfo.erc20Address).toString('hex');

                console.log('✅ Found pending deposit:', {
                  requestId,
                  amount: accountInfo.amount.toString(),
                  erc20Address,
                  requester: accountInfo.requester.toString(),
                  pda: account.pubkey.toString(),
                });

                pendingDeposits.push({
                  requestId,
                  amount: accountInfo.amount.toString(),
                  erc20Address,
                  requester: accountInfo.requester.toString(),
                  pda: account.pubkey.toString(),
                });
              }
            } else {
              console.log('⚠️  Program account method not available');
            }
          }
        } catch (error) {
          console.log(
            '⚠️  Failed to decode account:',
            account.pubkey.toString(),
            error,
          );
          continue;
        }
      }

      console.log('📊 Total pending deposits found:', pendingDeposits.length);
      return pendingDeposits;
    } catch (error) {
      console.error('❌ Error fetching pending deposits:', error);
      return [];
    }
  }

  async fetchUserBalances(publicKey: PublicKey): Promise<TokenBalance[]> {
    try {
      // NOTE: The current UserErc20Balance account structure doesn't store the user's public key
      // or ERC20 address in the account data. They are only used as PDA seeds.
      // This makes it challenging to efficiently query all balances for a specific user.
      //
      // Recommended solutions:
      // 1. Modify the contract to store user pubkey and/or ERC20 address in the account data
      // 2. Use an indexer (e.g., Helius, Shyft) to track balance accounts
      // 3. Maintain a separate registry of user's ERC20 tokens
      // 4. Use getProgramAccounts with memcmp filters if the account structure is updated

      // For now, we'll use a list of known ERC20 addresses and check each one
      // This is inefficient but works for demonstration purposes

      // Sepolia testnet ERC20 tokens to check for balances
      const commonErc20Addresses = [
        '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC Sepolia
        '0xbe72e441bf55620febc26715db68d3494213d8cb', // Other token
        '0x58eb19ef91e8a6327fed391b51ae1887b833cc91', // Other token
      ];

      // More efficient approach: directly fetch accounts for known ERC20 addresses
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

      // Note: The code below shows an alternative approach that fetches all accounts
      // and tries to match them. This is less efficient when you know the ERC20 addresses.

      /*
      // Get all UserErc20Balance accounts from the program
      const accounts = await this.connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            dataSize: 24, // 8 bytes discriminator + 16 bytes for u128 amount
          },
        ],
      });

      // Check each account to see if it belongs to this user
      for (const account of accounts) {
        // For each account, we need to check if it's a PDA for this user
        // We'll try to derive PDAs for known ERC20 addresses and see if they match
        
        for (const erc20Hex of commonErc20Addresses) {
          const erc20Bytes = Buffer.from(erc20Hex.replace('0x', ''), 'hex');
          
          const [expectedPda] = PublicKey.findProgramAddressSync(
            [
              Buffer.from('user_erc20_balance'),
              publicKey.toBuffer(),
              erc20Bytes,
            ],
            PROGRAM_ID,
          );
          
          if (expectedPda.equals(account.pubkey)) {
            // This account belongs to our user for this ERC20 token
            const data = account.account.data;
            
            // Read the amount (u128) which starts at offset 8 (after discriminator)
            // u128 is 16 bytes, we need to handle it properly
            const amountBytes = data.subarray(8, 24);
            let amount = 0n;
            
            // Read u128 as little-endian
            for (let i = 0; i < 16; i++) {
              amount |= BigInt(amountBytes[i]) << BigInt(i * 8);
            }
            
            balances.push({
              erc20Address: erc20Hex,
              amount: amount.toString(),
            });
            break; // Found the matching ERC20 address, no need to check others
          }
        }
      }
      */
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
      // Derive the PDA for this specific user and ERC20 token
      const erc20Bytes = Buffer.from(erc20Address.replace('0x', ''), 'hex');

      const [userBalancePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_erc20_balance'), publicKey.toBuffer(), erc20Bytes],
        PROGRAM_ID,
      );

      // Try to fetch the account
      const accountInfo = await this.connection.getAccountInfo(userBalancePda);

      if (!accountInfo) {
        // No balance account exists for this token
        return '0';
      }

      // Verify it's owned by our program
      if (!accountInfo.owner.equals(PROGRAM_ID)) {
        throw new Error('Account is not owned by the expected program');
      }

      // Read the amount (u128) which starts at offset 8 (after discriminator)
      const data = accountInfo.data;
      const amountBytes = data.subarray(8, 24);
      let amount = BigInt(0);

      // Read u128 as little-endian
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
      // Convert amount to proper units using decimals
      const amountBigInt = ethers.parseUnits(amount, decimals);
      // Ensure the amount is properly formatted as a u128 for Anchor
      const amountBN = new BN(amountBigInt.toString(), 10);

      console.log('🚀 Starting depositErc20 with params:', {
        publicKey: publicKey.toString(),
        erc20Address,
        amount,
        decimals,
        amountInUnits: amountBigInt.toString(),
      });

      // =====================================================
      // STEP 1: DERIVE ADDRESSES (matching test file)
      // =====================================================
      console.log('\n📍 Step 1: Deriving addresses...');

      // Derive vault authority PDA first
      const [vaultAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault_authority'), publicKey.toBuffer()],
        PROGRAM_ID,
      );

      // Use authority public key as path for request ID (as expected by contract)
      const path = publicKey.toString();
      const derivedPublicKey = derivePublicKey(
        path,
        vaultAuthority.toString(),
        CONFIG.BASE_PUBLIC_KEY,
      );
      const derivedAddress = ethers.computeAddress(derivedPublicKey);

      console.log('  👛 Solana wallet:', publicKey.toString());
      console.log('  📂 Path:', path);
      console.log('  🔑 Derived Ethereum address:', derivedAddress);
      console.log('  🏦 Vault authority:', vaultAuthority.toString());

      // =====================================================
      // STEP 2: PREPARE TRANSACTION (matching test file)
      // =====================================================
      console.log('\n📍 Step 2: Preparing transaction...');

      const hardcodedRecipient = '0x041477de8ecbcf633cb13ea10aa86cdf4d437c29';
      const erc20AddressBytes = Array.from(
        Buffer.from(erc20Address.slice(2), 'hex'),
      );

      // Build ERC20 transfer call data (FROM derived address TO vault)
      const transferInterface = new ethers.Interface([
        'function transfer(address to, uint256 amount) returns (bool)',
      ]);
      const callData = transferInterface.encodeFunctionData('transfer', [
        hardcodedRecipient,
        amountBigInt,
      ]);

      // Create transaction parameters with realistic values
      // Fetch the actual nonce from the Ethereum network
      const provider = new ethers.JsonRpcProvider(
        `https://sepolia.infura.io/v3/6df51ccaa17f4e078325b5050da5a2dd`,
      );
      const currentNonce = await provider.getTransactionCount(derivedAddress);
      console.log('🔢 Current nonce for derived address:', currentNonce);

      const txParams = createEvmTransactionParams(currentNonce);

      // Build EVM transaction for signing (FROM derived address)
      const tempTx = {
        type: 2, // EIP-1559
        chainId: 11155111, // Sepolia
        nonce: currentNonce,
        maxPriorityFeePerGas: txParams.maxPriorityFeePerGas,
        maxFeePerGas: txParams.maxFeePerGas,
        gasLimit: txParams.gasLimit,
        to: erc20Address,
        value: BigInt(0),
        data: callData,
      };

      const rlpEncodedTx = ethers.Transaction.from(tempTx).unsignedSerialized;

      // Generate request ID using the actual transaction data
      // For deposits, the contract expects empty string for params
      const requestId = generateRequestId(
        vaultAuthority, // Use vault authority as sender
        ethers.getBytes(rlpEncodedTx),
        60, // Ethereum SLIP-44
        0, // key_version
        path, // authority public key as string
        'ECDSA',
        'ethereum',
        '', // Empty string for params (as expected by contract)
      );

      console.log('🔑 Generated request ID:', requestId);

      // Convert request ID string to bytes
      const requestIdBytes = Array.from(Buffer.from(requestId.slice(2), 'hex'));

      // =====================================================
      // STEP 3: GET DEPOSIT ACCOUNTS (matching test file)
      // =====================================================
      console.log('\n📍 Step 3: Getting deposit accounts...');

      const [pendingDepositPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pending_erc20_deposit'), Buffer.from(requestIdBytes)],
        PROGRAM_ID,
      );

      // Check if pending deposit already exists
      const existingPendingDeposit =
        await this.connection.getAccountInfo(pendingDepositPda);
      if (existingPendingDeposit) {
        console.log('⚠️  Pending deposit already exists for this request ID');
        console.log('  🔑 Request ID:', requestId);
        console.log('  📍 PDA:', pendingDepositPda.toString());
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

      console.log('🗝️  Derived PDAs:', {
        vaultAuthority: vaultAuthority.toString(),
        pendingDeposit: pendingDepositPda.toString(),
        userBalance: userBalancePda.toString(),
        chainSignaturesState: chainSignaturesStatePda.toString(),
      });

      // Prepare transaction parameters for the program
      const evmParams = evmParamsToProgram(txParams);

      // =====================================================
      // STEP 4: DEPOSIT ERC20 (matching test file)
      // =====================================================
      console.log('\n📍 Step 4: Initiating deposit...');

      // Call the deposit_erc20 instruction
      console.log('📤 Calling deposit_erc20 instruction...');
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

      console.log('✅ Deposit ERC20 transaction signature:', tx);
      return tx;
    } catch (error) {
      console.error('❌ Deposit ERC20 failed:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(
        `Failed to deposit ERC20: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async claimErc20(publicKey: PublicKey, requestId: string): Promise<string> {
    try {
      // Parse the request ID
      const requestIdBytes = hexToBytes(requestId);

      // Derive required PDAs
      const [pendingDepositPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pending_erc20_deposit'), Buffer.from(requestIdBytes)],
        PROGRAM_ID,
      );

      // For now, we'll use mock data since we don't have the actual signature from chain signatures
      // In a real implementation, this would come from monitoring chain signatures events
      const mockSignature = createMockSignature();
      const mockSerializedOutput = createMockSerializedOutput();

      // First, get the pending deposit to find the ERC20 address
      console.log(
        '🔍 Looking for pending deposit at PDA:',
        pendingDepositPda.toString(),
      );
      console.log('🔑 Request ID:', requestId);
      console.log('🔢 Request ID bytes:', Array.from(requestIdBytes));

      let pendingDeposit;
      try {
        pendingDeposit =
          await this.getProgram().account.pendingErc20Deposit.fetch(
            pendingDepositPda,
          );
        console.log('✅ Found pending deposit:', pendingDeposit);
      } catch (error) {
        console.error('❌ Error fetching pending deposit:', error);
        console.error('🏦 PDA address:', pendingDepositPda.toString());

        // Check if account exists at all
        const accountInfo =
          await this.connection.getAccountInfo(pendingDepositPda);
        console.log('🔍 Account info:', accountInfo);

        throw new Error(
          `No pending deposit found for request ID ${requestId}. Make sure you have successfully deposited ERC20 tokens first.`,
        );
      }

      // Derive the user balance PDA
      const [userBalancePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('user_erc20_balance'),
          publicKey.toBuffer(),
          Buffer.from(pendingDeposit.erc20Address),
        ],
        PROGRAM_ID,
      );

      // Call the claim_erc20 instruction
      const tx = await this.getProgram()
        .methods.claimErc20(
          Array.from(requestIdBytes),
          mockSerializedOutput,
          mockSignature,
        )
        .accounts({
          authority: publicKey,
          pendingDeposit: pendingDepositPda,
          userBalance: userBalancePda,
          systemProgram: new PublicKey('11111111111111111111111111111111'),
        } as any)
        .rpc();

      console.log('Claim ERC20 transaction signature:', tx);
      return tx;
    } catch (error) {
      console.error('Claim ERC20 failed:', error);
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
    // TODO: Implement withdraw functionality
    console.log('Withdraw functionality to be implemented:', {
      publicKey: publicKey.toString(),
      erc20Address,
      amount,
    });

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 1000));

    throw new Error('Withdraw functionality not yet implemented');
  }
}
