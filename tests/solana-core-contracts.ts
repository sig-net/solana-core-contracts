import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaCoreContracts } from "../target/types/solana_core_contracts";
import { BN } from "@coral-xyz/anchor";
import { confirmTransaction, getTransactionReturnValue } from "../utils/solana";
import { assert } from "chai";
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
});
