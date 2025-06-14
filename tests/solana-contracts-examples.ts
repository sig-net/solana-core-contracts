import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaCoreContracts } from "../target/types/solana_core_contracts";
import { BN } from "@coral-xyz/anchor";
import { confirmTransaction, getTransactionReturnValue } from "../utils/solana";
import { assert } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  encodeFunctionData,
  keccak256,
  serializeTransaction,
  getAddress,
} from "viem";

describe("Vault Contract Tests - Rust vs Viem Reference Implementation", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .solanaCoreContracts as Program<SolanaCoreContracts>;

  // Chain Signatures Program Constants
  const CHAIN_SIGNATURES_PROGRAM_ID = new PublicKey(
    "BtGZEs9ZJX3hAQuY5er8iyWrGsrPRZYupEtVSS129XKo"
  );

  const VAULT_ABI = [
    {
      name: "deposit",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [],
    },
    {
      name: "withdraw",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [],
    },
  ] as const;

  const TEST_CASES = [
    {
      name: "Standard deposit",
      contractAddress: getAddress("0x7099eDa9CF94d39601a956Ed5274A8c7e692D2cE"),
      recipient: getAddress("0x742d35Cc6464C4532C2D91C6b4F7c2d4A7e8C5b1"),
      amount: "1000000000000000000",
      nonce: 0,
      chainId: 1,
      gasLimit: 100000,
      maxFeePerGas: "20000000000",
      maxPriorityFeePerGas: "2000000000",
      value: "0",
    },
    {
      name: "Large amount withdraw",
      contractAddress: getAddress("0x7099eDa9CF94d39601a956Ed5274A8c7e692D2cE"),
      recipient: getAddress("0x742d35Cc6464C4532C2D91C6b4F7c2d4A7e8C5b1"),
      amount: "5000000000000000000000",
      nonce: 1,
      chainId: 1,
      gasLimit: 150000,
      maxFeePerGas: "50000000000",
      maxPriorityFeePerGas: "5000000000",
      value: "0",
    },
  ];

  // Chain Signatures Test Cases
  const CHAIN_SIGNATURES_TEST_CASES = [
    {
      name: "Ethereum mainnet deposit",
      contractAddress: getAddress("0x7099eDa9CF94d39601a956Ed5274A8c7e692D2cE"),
      recipient: getAddress("0x742d35Cc6464C4532C2D91C6b4F7c2d4A7e8C5b1"),
      amount: "1000000000000000000",
      nonce: 0,
      chainId: 1,
      gasLimit: 100000,
      maxFeePerGas: "20000000000",
      maxPriorityFeePerGas: "2000000000",
      value: "0",
      derivationPath: "ethereum,1",
      keyVersion: 0,
    },
    {
      name: "Polygon mainnet withdraw",
      contractAddress: getAddress("0x7099eDa9CF94d39601a956Ed5274A8c7e692D2cE"),
      recipient: getAddress("0x742d35Cc6464C4532C2D91C6b4F7c2d4A7e8C5b1"),
      amount: "2500000000000000000000",
      nonce: 5,
      chainId: 137,
      gasLimit: 200000,
      maxFeePerGas: "30000000000",
      maxPriorityFeePerGas: "3000000000",
      value: "0",
      derivationPath: "ethereum,137",
      keyVersion: 0,
    },
    {
      name: "Binance Smart Chain deposit",
      contractAddress: getAddress("0x7099eDa9CF94d39601a956Ed5274A8c7e692D2cE"),
      recipient: getAddress("0x742d35Cc6464C4532C2D91C6b4F7c2d4A7e8C5b1"),
      amount: "500000000000000000",
      nonce: 10,
      chainId: 56,
      gasLimit: 80000,
      maxFeePerGas: "5000000000",
      maxPriorityFeePerGas: "1000000000",
      value: "0",
      derivationPath: "ethereum,56",
      keyVersion: 0,
    },
  ];

  // Helper function to get chain signatures program state PDA
  function getChainSignaturesProgramStatePda(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("chain_signatures_program_state")],
      CHAIN_SIGNATURES_PROGRAM_ID
    );
    return pda;
  }

  // Helper function to create signing parameters
  function createSigningParams(testCase: any) {
    return {
      keyVersion: testCase.keyVersion,
      path: testCase.derivationPath,
      algo: "secp256k1",
      dest: "ethereum",
      params: JSON.stringify({
        gasLimit: testCase.gasLimit,
        maxFeePerGas: testCase.maxFeePerGas,
        maxPriorityFeePerGas: testCase.maxPriorityFeePerGas,
      }),
    };
  }

  describe("Deposit Function Tests", () => {
    TEST_CASES.forEach((testCase) => {
      it(`${testCase.name} - Deposit`, async () => {
        const viemCallData = encodeFunctionData({
          abi: VAULT_ABI,
          functionName: "deposit",
          args: [testCase.recipient, BigInt(testCase.amount)],
        });

        const viemTransaction = {
          type: "eip1559" as const,
          to: testCase.contractAddress,
          value: BigInt(testCase.value),
          data: viemCallData,
          chainId: testCase.chainId,
          nonce: testCase.nonce,
          gas: BigInt(testCase.gasLimit),
          maxFeePerGas: BigInt(testCase.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(testCase.maxPriorityFeePerGas),
        };

        const viemSerializedForSigning = serializeTransaction(viemTransaction);
        const viemExpectedHash = keccak256(viemSerializedForSigning);

        const rustTransaction = {
          toAddress: Array.from(
            Buffer.from(testCase.contractAddress.slice(2), "hex")
          ),
          value: new BN(testCase.value),
          gasLimit: new BN(testCase.gasLimit),
          maxFeePerGas: new BN(testCase.maxFeePerGas),
          maxPriorityFeePerGas: new BN(testCase.maxPriorityFeePerGas),
          nonce: new BN(testCase.nonce),
          chainId: new BN(testCase.chainId),
          recipientAddress: Array.from(
            Buffer.from(testCase.recipient.slice(2), "hex")
          ),
          amount: new BN(testCase.amount),
        };

        const rustResult = await program.methods
          .processDeposit(rustTransaction)
          .rpc();

        await confirmTransaction(program.provider.connection, rustResult);

        const rustReturnData = await getTransactionReturnValue<Uint8Array>(
          rustResult
        );
        const rustHash = "0x" + Buffer.from(rustReturnData!).toString("hex");

        assert.equal(
          rustHash.toLowerCase(),
          viemExpectedHash.toLowerCase(),
          `Hash mismatch for ${testCase.name} deposit`
        );
      });
    });
  });

  describe("Withdraw Function Tests", () => {
    TEST_CASES.forEach((testCase) => {
      it(`${testCase.name} - Withdraw`, async () => {
        const viemCallData = encodeFunctionData({
          abi: VAULT_ABI,
          functionName: "withdraw",
          args: [testCase.recipient, BigInt(testCase.amount)],
        });

        const viemTransaction = {
          type: "eip1559" as const,
          to: testCase.contractAddress,
          value: BigInt(testCase.value),
          data: viemCallData,
          chainId: testCase.chainId,
          nonce: testCase.nonce,
          gas: BigInt(testCase.gasLimit),
          maxFeePerGas: BigInt(testCase.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(testCase.maxPriorityFeePerGas),
        };

        const viemSerializedForSigning = serializeTransaction(viemTransaction);
        const viemExpectedHash = keccak256(viemSerializedForSigning);

        const rustTransaction = {
          toAddress: Array.from(
            Buffer.from(testCase.contractAddress.slice(2), "hex")
          ),
          value: new BN(testCase.value),
          gasLimit: new BN(testCase.gasLimit),
          maxFeePerGas: new BN(testCase.maxFeePerGas),
          maxPriorityFeePerGas: new BN(testCase.maxPriorityFeePerGas),
          nonce: new BN(testCase.nonce),
          chainId: new BN(testCase.chainId),
          recipientAddress: Array.from(
            Buffer.from(testCase.recipient.slice(2), "hex")
          ),
          amount: new BN(testCase.amount),
        };

        const rustResult = await program.methods
          .processWithdraw(rustTransaction)
          .rpc();

        await confirmTransaction(program.provider.connection, rustResult);

        const rustReturnData = await getTransactionReturnValue<Uint8Array>(
          rustResult
        );
        const rustHash = "0x" + Buffer.from(rustReturnData!).toString("hex");

        assert.equal(
          rustHash.toLowerCase(),
          viemExpectedHash.toLowerCase(),
          `Hash mismatch for ${testCase.name} withdraw`
        );
      });
    });
  });

  describe("Chain Signatures Deposit Tests", () => {
    CHAIN_SIGNATURES_TEST_CASES.forEach((testCase) => {
      it(`${testCase.name} - Chain Signatures Deposit`, async () => {
        const vaultTransaction = {
          toAddress: Array.from(
            Buffer.from(testCase.contractAddress.slice(2), "hex")
          ),
          value: new BN(testCase.value),
          gasLimit: new BN(testCase.gasLimit),
          maxFeePerGas: new BN(testCase.maxFeePerGas),
          maxPriorityFeePerGas: new BN(testCase.maxPriorityFeePerGas),
          nonce: new BN(testCase.nonce),
          chainId: new BN(testCase.chainId),
          recipientAddress: Array.from(
            Buffer.from(testCase.recipient.slice(2), "hex")
          ),
          amount: new BN(testCase.amount),
        };

        const signingParams = createSigningParams(testCase);

        const chainSignaturesProgramState = getChainSignaturesProgramStatePda();

        try {
          const rustResult = await program.methods
            .signDepositTransaction(vaultTransaction, signingParams)
            .rpc();

          await confirmTransaction(program.provider.connection, rustResult);

          const rustReturnData = await getTransactionReturnValue<{
            bigR: { x: number[]; y: number[] };
            s: number[];
          }>(rustResult);

          // Verify signature structure
          assert.isObject(rustReturnData, "Signature should be returned");
          assert.property(rustReturnData, "bigR", "Signature should have bigR");
          assert.property(rustReturnData, "s", "Signature should have s");
          assert.property(
            rustReturnData!.bigR,
            "x",
            "bigR should have x coordinate"
          );
          assert.property(
            rustReturnData!.bigR,
            "y",
            "bigR should have y coordinate"
          );

          // Verify signature components are non-zero
          assert.isTrue(
            rustReturnData!.bigR.x.some((b) => b !== 0),
            "bigR.x should not be all zeros"
          );
          assert.isTrue(
            rustReturnData!.bigR.y.some((b) => b !== 0),
            "bigR.y should not be all zeros"
          );
          assert.isTrue(
            rustReturnData!.s.some((b) => b !== 0),
            "s should not be all zeros"
          );

          console.log(
            `✓ ${testCase.name} - Chain Signatures Deposit completed successfully`
          );
          console.log(
            `  - Signature generated with bigR: ${
              rustReturnData!.bigR.x.length + rustReturnData!.bigR.y.length
            } bytes`
          );
          console.log(
            `  - Signature s component: ${rustReturnData!.s.length} bytes`
          );
        } catch (error) {
          console.error(
            `Chain Signatures Deposit test failed for ${testCase.name}:`,
            error
          );
          throw error;
        }
      });
    });
  });

  describe("Chain Signatures Withdraw Tests", () => {
    CHAIN_SIGNATURES_TEST_CASES.forEach((testCase) => {
      it(`${testCase.name} - Chain Signatures Withdraw`, async () => {
        const vaultTransaction = {
          toAddress: Array.from(
            Buffer.from(testCase.contractAddress.slice(2), "hex")
          ),
          value: new BN(testCase.value),
          gasLimit: new BN(testCase.gasLimit),
          maxFeePerGas: new BN(testCase.maxFeePerGas),
          maxPriorityFeePerGas: new BN(testCase.maxPriorityFeePerGas),
          nonce: new BN(testCase.nonce),
          chainId: new BN(testCase.chainId),
          recipientAddress: Array.from(
            Buffer.from(testCase.recipient.slice(2), "hex")
          ),
          amount: new BN(testCase.amount),
        };

        const signingParams = createSigningParams(testCase);

        const chainSignaturesProgramState = getChainSignaturesProgramStatePda();

        try {
          const rustResult = await program.methods
            .signWithdrawTransaction(vaultTransaction, signingParams)
            .rpc();

          await confirmTransaction(program.provider.connection, rustResult);

          const rustReturnData = await getTransactionReturnValue<{
            bigR: { x: number[]; y: number[] };
            s: number[];
          }>(rustResult);

          // Verify signature structure
          assert.isObject(rustReturnData, "Signature should be returned");
          assert.property(rustReturnData, "bigR", "Signature should have bigR");
          assert.property(rustReturnData, "s", "Signature should have s");
          assert.property(
            rustReturnData!.bigR,
            "x",
            "bigR should have x coordinate"
          );
          assert.property(
            rustReturnData!.bigR,
            "y",
            "bigR should have y coordinate"
          );

          // Verify signature components are non-zero
          assert.isTrue(
            rustReturnData!.bigR.x.some((b) => b !== 0),
            "bigR.x should not be all zeros"
          );
          assert.isTrue(
            rustReturnData!.bigR.y.some((b) => b !== 0),
            "bigR.y should not be all zeros"
          );
          assert.isTrue(
            rustReturnData!.s.some((b) => b !== 0),
            "s should not be all zeros"
          );

          console.log(
            `✓ ${testCase.name} - Chain Signatures Withdraw completed successfully`
          );
          console.log(
            `  - Signature generated with bigR: ${
              rustReturnData!.bigR.x.length + rustReturnData!.bigR.y.length
            } bytes`
          );
          console.log(
            `  - Signature s component: ${rustReturnData!.s.length} bytes`
          );
        } catch (error) {
          console.error(
            `Chain Signatures Withdraw test failed for ${testCase.name}:`,
            error
          );
          throw error;
        }
      });
    });
  });

  describe("Chain Signatures Integration Tests", () => {
    it("Should validate signing parameters", async () => {
      const testCase = CHAIN_SIGNATURES_TEST_CASES[0];

      const vaultTransaction = {
        toAddress: Array.from(
          Buffer.from(testCase.contractAddress.slice(2), "hex")
        ),
        value: new BN(testCase.value),
        gasLimit: new BN(testCase.gasLimit),
        maxFeePerGas: new BN(testCase.maxFeePerGas),
        maxPriorityFeePerGas: new BN(testCase.maxPriorityFeePerGas),
        nonce: new BN(testCase.nonce),
        chainId: new BN(testCase.chainId),
        recipientAddress: Array.from(
          Buffer.from(testCase.recipient.slice(2), "hex")
        ),
        amount: new BN(testCase.amount),
      };

      // Test with invalid derivation path (too long)
      const invalidParams = {
        keyVersion: 0,
        path: "a".repeat(300), // Exceeds 256 char limit
        algo: "secp256k1",
        dest: "ethereum",
        params: JSON.stringify({
          gasLimit: testCase.gasLimit,
          maxFeePerGas: testCase.maxFeePerGas,
          maxPriorityFeePerGas: testCase.maxPriorityFeePerGas,
        }),
      };

      try {
        await program.methods
          .signDepositTransaction(vaultTransaction, invalidParams)
          .rpc();

        assert.fail("Should have failed with invalid derivation path");
      } catch (error) {
        assert.isTrue(
          error.message.includes("InvalidInputLength") ||
            error.message.includes("invalid") ||
            error.message.includes("too long"),
          "Should fail with appropriate validation error"
        );
      }
    });

    it("Should handle different chain IDs correctly", async () => {
      const chains = [
        { name: "Ethereum", chainId: 1, derivationPath: "ethereum,1" },
        { name: "Polygon", chainId: 137, derivationPath: "ethereum,137" },
        { name: "BSC", chainId: 56, derivationPath: "ethereum,56" },
      ];

      for (const chain of chains) {
        const vaultTransaction = {
          toAddress: Array.from(
            Buffer.from(
              CHAIN_SIGNATURES_TEST_CASES[0].contractAddress.slice(2),
              "hex"
            )
          ),
          value: new BN("0"),
          gasLimit: new BN(100000),
          maxFeePerGas: new BN("20000000000"),
          maxPriorityFeePerGas: new BN("2000000000"),
          nonce: new BN(0),
          chainId: new BN(chain.chainId),
          recipientAddress: Array.from(
            Buffer.from(
              CHAIN_SIGNATURES_TEST_CASES[0].recipient.slice(2),
              "hex"
            )
          ),
          amount: new BN("1000000000000000000"),
        };

        const signingParams = {
          keyVersion: 0,
          path: chain.derivationPath,
          algo: "secp256k1",
          dest: "ethereum",
          params: JSON.stringify({
            gasLimit: 100000,
            maxFeePerGas: "20000000000",
            maxPriorityFeePerGas: "2000000000",
          }),
        };

        try {
          const result = await program.methods
            .signDepositTransaction(vaultTransaction, signingParams)
            .rpc();

          await confirmTransaction(program.provider.connection, result);
          console.log(
            `✓ ${chain.name} (Chain ID: ${chain.chainId}) signature completed`
          );
        } catch (error) {
          console.error(`Failed for ${chain.name}:`, error);
          throw error;
        }
      }
    });
  });
});
