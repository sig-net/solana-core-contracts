import { Connection, PublicKey } from '@solana/web3.js';

import type { TokenBalance } from '@/components/balance-table';

const PROGRAM_ID = new PublicKey(
  'GDMMWC3YiZEffb2u5dw6FTLRY5wV5vAcXP72LRAJaVhK',
);

export class SolanaService {
  constructor(private connection: Connection) {}

  async deriveDepositAddress(_publicKey: PublicKey): Promise<string> {
    // For this bridge, deposits happen on Ethereum to a hardcoded address
    // This is the same address used in the contract (erc20_vault.rs:15)
    const ETH_DEPOSIT_ADDRESS = '0x041477de8ecbcf633cb13ea10aa86cdf4d437c29';

    // Return the Ethereum deposit address - this is where users send ERC20 tokens
    return ETH_DEPOSIT_ADDRESS;
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
        '0xbe72e441bf55620febc26715db68d3494213d8cb',
        '0x58eb19ef91e8a6327fed391b51ae1887b833cc91',
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
    requestId: string,
  ): Promise<string> {
    // TODO: Implement deposit_erc20 transaction
    console.log('Deposit ERC20 functionality to be implemented:', {
      publicKey: publicKey.toString(),
      erc20Address,
      amount,
      requestId,
    });

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Return mock transaction signature
    return 'mock_deposit_tx_signature_' + Date.now();
  }

  async claimErc20(publicKey: PublicKey, requestId: string): Promise<string> {
    // TODO: Implement claim_erc20 transaction
    console.log('Claim ERC20 functionality to be implemented:', {
      publicKey: publicKey.toString(),
      requestId,
    });

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Return mock transaction signature
    return 'mock_claim_tx_signature_' + Date.now();
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
