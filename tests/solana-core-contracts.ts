import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaCoreContracts } from "../target/types/solana_core_contracts";
import { BN } from "@coral-xyz/anchor";

describe("solana-core-contracts", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .solanaCoreContracts as Program<SolanaCoreContracts>;

  it("Should process ethereum transaction", async () => {
    try {
      // Create a sample Ethereum transaction
      const ethereumTx = {
        toAddress: [
          0x70, 0x99, 0x7e, 0xda, 0x9c, 0xf9, 0x4d, 0x39, 0x60, 0x1a, 0x95,
          0x6e, 0xd5, 0x27, 0x4a, 0x8c, 0x7e, 0x69, 0x2d, 0x2c,
        ], // Sample Ethereum address
        value: new BN("1000000000000000000"), // 1 ETH in wei as BN
        gasLimit: new BN("21000"),
        maxFeePerGas: new BN("20000000000"), // 20 gwei
        maxPriorityFeePerGas: new BN("2000000000"), // 2 gwei
        nonce: new BN(0),
        chainId: new BN(1), // Ethereum mainnet
        data: Buffer.from([]), // Empty data for simple transfer
      };

      const tx = await program.methods
        .processEthereumTransaction(ethereumTx)
        .rpc();

      console.log("Transaction signature:", tx);

      // Get transaction details to see logs
      const connection = anchor.getProvider().connection;
      const txDetails = await connection.getTransaction(tx, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (txDetails?.meta?.logMessages) {
        console.log("Transaction logs:");
        txDetails.meta.logMessages.forEach((log, index) => {
          console.log(`${index}: ${log}`);
        });
      }
    } catch (error) {
      console.log("Error:", error);
    }
  });
});
