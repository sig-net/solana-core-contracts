import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaCoreContracts } from "../target/types/solana_core_contracts";
import { ChainSignaturesProject } from "../types/chain_signatures_project";
import IDL from "../idl/chain_signatures_project.json";
import { expect } from "chai";
import { ethers } from "ethers";
import { secp256k1 } from "@noble/curves/secp256k1";

const CONFIG = {
  // API Keys
  INFURA_API_KEY: "6df51ccaa17f4e078325b5050da5a2dd",

  // Contract Addresses
  USDC_ADDRESS_SEPOLIA: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  HARDCODED_RECIPIENT: "0x00A40C2661293d5134E53Da52951A3F7767836Ef",

  // Chain Configuration
  SEPOLIA_CHAIN_ID: 11155111,
  ETHEREUM_SLIP44: 60,

  // Cryptography
  BASE_PUBLIC_KEY:
    "0x044eef776e4f257d68983e45b340c2e9546c5df95447900b6aadfec68fb46fdee257e26b8ba383ddba9914b33c60e869265f859566fff4baef283c54d821ca3b64",
  EPSILON_DERIVATION_PREFIX: "sig.network v1.0.0 epsilon derivation",
  SOLANA_CHAIN_ID: "0x800001f5",

  // Timing
  WAIT_FOR_FUNDING_MS: 5000,

  // Test Parameters
  TRANSFER_AMOUNT: "0.1", // USDC
  DECIMALS: 6,
  GAS_BUFFER_PERCENT: 20,

  // Solana Programs
  CHAIN_SIGNATURES_PROGRAM_ID: "4uvZW8K4g4jBg7dzPNbb9XDxJLFBK7V6iC76uofmYvEU",
} as const;

interface TransactionParams {
  nonce: anchor.BN;
  value: anchor.BN;
  maxPriorityFeePerGas: anchor.BN;
  maxFeePerGas: anchor.BN;
  gasLimit: anchor.BN;
  chainId: anchor.BN;
}

interface Point {
  x: bigint;
  y: bigint;
}

class CryptoUtils {
  /**
   * Derive epsilon value for key derivation
   */
  static deriveEpsilon(requester: string, path: string): bigint {
    const derivationPath = `${CONFIG.EPSILON_DERIVATION_PREFIX},${CONFIG.SOLANA_CHAIN_ID},${requester},${path}`;
    console.log("📝 Derivation path:", derivationPath);
    const hash = ethers.keccak256(ethers.toUtf8Bytes(derivationPath));
    return BigInt(hash);
  }

  /**
   * Convert public key string to elliptic curve point
   */
  static publicKeyToPoint(publicKey: string): Point {
    const cleanPubKey = publicKey.slice(4); // Remove 0x04 prefix
    const x = cleanPubKey.slice(0, 64);
    const y = cleanPubKey.slice(64, 128);
    return {
      x: BigInt("0x" + x),
      y: BigInt("0x" + y),
    };
  }

  /**
   * Convert elliptic curve point to public key string
   */
  static pointToPublicKey(point: Point): string {
    const x = point.x.toString(16).padStart(64, "0");
    const y = point.y.toString(16).padStart(64, "0");
    return "0x04" + x + y;
  }

  /**
   * Derive public key using epsilon and base public key
   */
  static derivePublicKey(
    path: string,
    requesterAddress: string,
    basePublicKey: string
  ): string {
    try {
      const epsilon = this.deriveEpsilon(requesterAddress, path);
      const basePoint = this.publicKeyToPoint(basePublicKey);

      // Calculate epsilon * G
      const epsilonPoint = secp256k1.ProjectivePoint.BASE.multiply(epsilon);

      // Convert base point to projective
      const baseProjectivePoint = new secp256k1.ProjectivePoint(
        basePoint.x,
        basePoint.y,
        BigInt(1)
      );

      // Add points: result = base + epsilon * G
      const resultPoint = epsilonPoint.add(baseProjectivePoint);
      const resultAffine = resultPoint.toAffine();

      const derivedPublicKey = this.pointToPublicKey({
        x: resultAffine.x,
        y: resultAffine.y,
      });

      console.log("🔑 Derived public key:", derivedPublicKey);
      return derivedPublicKey;
    } catch (error) {
      console.error("❌ Error deriving public key:", error);
      throw error;
    }
  }

  /**
   * Generate request ID for sign_respond
   */
  static generateSignRespondRequestId(
    sender: string,
    transactionData: number[],
    slip44ChainId: number,
    keyVersion: number,
    path: string,
    algo: string,
    dest: string,
    params: string
  ): string {
    console.log("\n📋 Generating Request ID");
    console.log("  👤 Sender:", sender);
    console.log("  📦 TX data length:", transactionData.length);
    console.log("  🔢 Chain ID:", slip44ChainId);
    console.log("  📂 Path:", path);

    const txDataHex = "0x" + Buffer.from(transactionData).toString("hex");

    // Use encodePacked to match Solana's abi_encode_packed
    const encoded = ethers.solidityPacked(
      [
        "string",
        "bytes",
        "uint32",
        "uint32",
        "string",
        "string",
        "string",
        "string",
      ],
      [sender, txDataHex, slip44ChainId, keyVersion, path, algo, dest, params]
    );

    const hash = ethers.keccak256(encoded);
    console.log("  🔑 Request ID:", hash);

    return hash;
  }
}

class EthereumUtils {
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(
      `https://sepolia.infura.io/v3/${CONFIG.INFURA_API_KEY}`
    );
  }

  /**
   * Build ERC20 transfer transaction
   */
  async buildTransferTransaction(
    from: string,
    amount: bigint
  ): Promise<{
    callData: string;
    txParams: TransactionParams;
    rlpEncodedTx: string;
    nonce: number;
  }> {
    // Get current nonce
    const nonce = await this.provider.getTransactionCount(from);
    console.log("📊 Current nonce:", nonce);

    // Build call data
    const transferInterface = new ethers.Interface([
      "function transfer(address to, uint256 amount) returns (bool)",
    ]);
    const callData = transferInterface.encodeFunctionData("transfer", [
      CONFIG.HARDCODED_RECIPIENT,
      amount,
    ]);

    // Get gas prices
    const feeData = await this.provider.getFeeData();
    const maxFeePerGas =
      feeData.maxFeePerGas || ethers.parseUnits("30", "gwei");
    const maxPriorityFeePerGas =
      feeData.maxPriorityFeePerGas || ethers.parseUnits("2", "gwei");

    console.log("\n⛽ Gas prices:");
    console.log("  Max fee:", ethers.formatUnits(maxFeePerGas, "gwei"), "gwei");
    console.log(
      "  Priority fee:",
      ethers.formatUnits(maxPriorityFeePerGas, "gwei"),
      "gwei"
    );

    // Estimate gas
    const gasEstimate = await this.provider.estimateGas({
      from,
      to: CONFIG.USDC_ADDRESS_SEPOLIA,
      data: callData,
    });

    const gasLimit =
      (gasEstimate * BigInt(100 + CONFIG.GAS_BUFFER_PERCENT)) / BigInt(100);
    console.log("  Gas limit (with buffer):", gasLimit.toString());

    // Create transaction params
    const txParams: TransactionParams = {
      nonce: new anchor.BN(nonce),
      value: new anchor.BN(0),
      maxPriorityFeePerGas: new anchor.BN(maxPriorityFeePerGas.toString()),
      maxFeePerGas: new anchor.BN(maxFeePerGas.toString()),
      gasLimit: new anchor.BN(gasLimit.toString()),
      chainId: new anchor.BN(CONFIG.SEPOLIA_CHAIN_ID),
    };

    // Build RLP-encoded transaction
    const tempTx = {
      type: 2, // EIP-1559
      chainId: CONFIG.SEPOLIA_CHAIN_ID,
      nonce,
      maxPriorityFeePerGas,
      maxFeePerGas,
      gasLimit,
      to: CONFIG.USDC_ADDRESS_SEPOLIA,
      value: BigInt(0),
      data: callData,
    };

    const rlpEncodedTx = ethers.Transaction.from(tempTx).unsignedSerialized;

    return {
      callData,
      txParams,
      rlpEncodedTx: ethers.hexlify(rlpEncodedTx),
      nonce,
    };
  }

  /**
   * Submit signed transaction to Ethereum
   */
  async submitTransaction(signedTx: ethers.Transaction): Promise<string> {
    console.log("\n📡 Broadcasting transaction to Sepolia...");
    const txHash = await this.provider.send("eth_sendRawTransaction", [
      signedTx.serialized,
    ]);
    console.log("  🔗 Transaction hash:", txHash);
    return txHash;
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(
    txHash: string
  ): Promise<ethers.TransactionReceipt> {
    console.log("\n⏳ Waiting for transaction confirmation...");
    const receipt = await this.provider.waitForTransaction(txHash, 1);
    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }
    console.log("  ✅ Confirmed in block:", receipt.blockNumber);
    console.log(
      "  📊 Status:",
      receipt.status === 1 ? "Success ✅" : "Failed ❌"
    );
    return receipt;
  }
}

describe("🏦 ERC20 Deposit Flow", () => {
  // Test context
  let provider: anchor.AnchorProvider;
  let program: Program<SolanaCoreContracts>;
  let chainSignaturesProgram: Program<ChainSignaturesProject>;
  let ethUtils: EthereumUtils;

  before(() => {
    // Setup Anchor provider
    provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // Initialize programs
    program = anchor.workspace
      .SolanaCoreContracts as Program<SolanaCoreContracts>;
    chainSignaturesProgram = new Program<ChainSignaturesProject>(IDL, provider);

    // Initialize Ethereum utilities
    ethUtils = new EthereumUtils();
  });

  it("Should complete full ERC20 deposit flow", async function () {
    console.log("\n🚀 Starting ERC20 Deposit Flow Test\n");

    // =====================================================
    // STEP 1: DERIVE ADDRESSES
    // =====================================================

    console.log("📍 Step 1: Deriving addresses...");

    const [vaultAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault_authority"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    const path = provider.wallet.publicKey.toString();
    const derivedPublicKey = CryptoUtils.derivePublicKey(
      path,
      vaultAuthority.toString(),
      CONFIG.BASE_PUBLIC_KEY
    );
    const derivedAddress = ethers.computeAddress(derivedPublicKey);

    console.log("  👛 Solana wallet:", provider.wallet.publicKey.toString());
    console.log("  📂 Path:", path);
    console.log("  🔑 Derived Ethereum address:", derivedAddress);

    // Give user time to fund the address
    console.log("\n⚠️  Please ensure this address has USDC tokens!");
    console.log("  Waiting 5 seconds...\n");
    await new Promise((resolve) =>
      setTimeout(resolve, CONFIG.WAIT_FOR_FUNDING_MS)
    );

    // =====================================================
    // STEP 2: PREPARE TRANSACTION
    // =====================================================

    console.log("📍 Step 2: Preparing transaction...");

    const amountBigInt = ethers.parseUnits(
      CONFIG.TRANSFER_AMOUNT,
      CONFIG.DECIMALS
    );
    const amountBN = new anchor.BN(amountBigInt.toString());
    const erc20AddressBytes = Array.from(
      Buffer.from(CONFIG.USDC_ADDRESS_SEPOLIA.slice(2), "hex")
    );

    const { callData, txParams, rlpEncodedTx, nonce } =
      await ethUtils.buildTransferTransaction(derivedAddress, amountBigInt);

    // Generate request ID
    const requestId = CryptoUtils.generateSignRespondRequestId(
      vaultAuthority.toString(),
      Array.from(ethers.getBytes(rlpEncodedTx)),
      CONFIG.ETHEREUM_SLIP44,
      0, // key_version
      path,
      "ECDSA",
      "ethereum",
      ""
    );
    const requestIdBytes = Array.from(Buffer.from(requestId.slice(2), "hex"));

    // =====================================================
    // STEP 3: SETUP EVENT LISTENERS
    // =====================================================

    console.log("\n📍 Step 3: Setting up event listeners...");

    const eventPromises = setupEventListeners(
      chainSignaturesProgram,
      requestId
    );

    // =====================================================
    // STEP 4: DEPOSIT ERC20
    // =====================================================

    console.log("\n📍 Step 4: Initiating deposit...");

    const accounts = await getDepositAccounts(
      program,
      provider,
      requestIdBytes,
      erc20AddressBytes
    );

    // Check initial balance
    const initialBalance = await getInitialBalance(
      program,
      accounts.userBalance
    );

    // Execute deposit
    const depositTx = await program.methods
      .depositErc20(
        requestIdBytes as any,
        erc20AddressBytes as any,
        amountBN,
        txParams
      )
      .accounts({
        authority: provider.wallet.publicKey,
        feePayer: provider.wallet.publicKey,
        instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .rpc();

    console.log("  ✅ Deposit transaction:", depositTx);

    // =====================================================
    // STEP 5: WAIT FOR SIGNATURE
    // =====================================================

    console.log("\n📍 Step 5: Waiting for signature...");

    const signatureEvent = (await eventPromises.signature) as any;
    const signature = extractSignature(signatureEvent);

    // =====================================================
    // STEP 6: SUBMIT TO ETHEREUM
    // =====================================================

    console.log("\n📍 Step 6: Submitting to Ethereum...");

    const signedTx = ethers.Transaction.from({
      type: 2,
      chainId: CONFIG.SEPOLIA_CHAIN_ID,
      nonce,
      maxPriorityFeePerGas: BigInt(txParams.maxPriorityFeePerGas.toString()),
      maxFeePerGas: BigInt(txParams.maxFeePerGas.toString()),
      gasLimit: BigInt(txParams.gasLimit.toString()),
      to: CONFIG.USDC_ADDRESS_SEPOLIA,
      value: BigInt(0),
      data: callData,
      signature,
    });

    const txHash = await ethUtils.submitTransaction(signedTx);
    const receipt = await ethUtils.waitForConfirmation(txHash);

    // =====================================================
    // STEP 7: CLAIM DEPOSIT
    // =====================================================

    console.log("\n📍 Step 7: Claiming deposit...");

    const readEvent = (await eventPromises.readRespond) as any;
    console.log("  ✅ Got read response!");

    const claimTx = await program.methods
      .claimErc20(
        requestIdBytes as any,
        Buffer.from(readEvent.serializedOutput),
        readEvent.signature
      )
      .accounts({
        authority: provider.wallet.publicKey,
        userBalance: accounts.userBalance,
      })
      .rpc();

    console.log("  ✅ Claim transaction:", claimTx);

    // =====================================================
    // STEP 8: VERIFY BALANCE
    // =====================================================

    console.log("\n📍 Step 8: Verifying balance...");

    const finalBalance = await program.account.userErc20Balance.fetch(
      accounts.userBalance
    );
    const expectedBalance = initialBalance.add(amountBN);

    console.log("  💰 Initial balance:", initialBalance.toString());
    console.log("  ➕ Amount deposited:", amountBN.toString());
    console.log("  💰 Final balance:", finalBalance.amount.toString());
    console.log("  ✅ Expected balance:", expectedBalance.toString());

    expect(finalBalance.amount.toString()).to.equal(expectedBalance.toString());

    // Cleanup
    await cleanupEventListeners(chainSignaturesProgram, eventPromises);

    console.log("\n🎉 ERC20 deposit flow completed successfully!");
  });
});

/**
 * Setup event listeners for chain signatures
 */
function setupEventListeners(
  program: Program<ChainSignaturesProject>,
  requestId: string
) {
  let signatureResolve: (value: any) => void;
  let readRespondResolve: (value: any) => void;

  const signaturePromise = new Promise((resolve) => {
    signatureResolve = resolve;
  });

  const readRespondPromise = new Promise((resolve) => {
    readRespondResolve = resolve;
  });

  const signatureListener = program.addEventListener(
    "signatureRespondedEvent",
    (event) => {
      const eventRequestId =
        "0x" + Buffer.from(event.requestId).toString("hex");
      if (eventRequestId === requestId) {
        console.log("  ✅ Signature event received!");
        signatureResolve(event);
      }
    }
  );

  const readRespondListener = program.addEventListener(
    "readRespondedEvent",
    (event) => {
      const eventRequestId =
        "0x" + Buffer.from(event.requestId).toString("hex");
      if (eventRequestId === requestId) {
        console.log("  ✅ Read respond event received!");
        readRespondResolve(event);
      }
    }
  );

  return {
    signature: signaturePromise,
    readRespond: readRespondPromise,
    signatureListener,
    readRespondListener,
  };
}

/**
 * Get deposit accounts
 */
async function getDepositAccounts(
  program: Program<SolanaCoreContracts>,
  provider: anchor.AnchorProvider,
  requestIdBytes: number[],
  erc20AddressBytes: number[]
) {
  const [pendingDeposit] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pending_erc20_deposit"), Buffer.from(requestIdBytes)],
    program.programId
  );

  const [userBalance] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("user_erc20_balance"),
      provider.wallet.publicKey.toBuffer(),
      Buffer.from(erc20AddressBytes),
    ],
    program.programId
  );

  const [chainSignaturesState] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("program-state")],
    new anchor.web3.PublicKey(CONFIG.CHAIN_SIGNATURES_PROGRAM_ID)
  );

  return { pendingDeposit, userBalance, chainSignaturesState };
}

/**
 * Get initial balance
 */
async function getInitialBalance(
  program: Program<SolanaCoreContracts>,
  userBalance: anchor.web3.PublicKey
): Promise<anchor.BN> {
  try {
    const account = await program.account.userErc20Balance.fetch(userBalance);
    console.log("  💰 Initial balance:", account.amount.toString());
    return account.amount;
  } catch {
    console.log("  💰 No existing balance");
    return new anchor.BN(0);
  }
}

/**
 * Extract signature from event
 */
function extractSignature(event: any) {
  const signature = event.signature;
  const r = "0x" + Buffer.from(signature.bigR.x).toString("hex");
  const s = "0x" + Buffer.from(signature.s).toString("hex");
  const v = BigInt(signature.recoveryId + 27);

  console.log("  🔏 Signature components:");
  console.log("    r:", r);
  console.log("    s:", s);
  console.log("    v:", v);

  return { r, s, v };
}

/**
 * Cleanup event listeners
 */
async function cleanupEventListeners(
  program: Program<ChainSignaturesProject>,
  eventPromises: any
) {
  await program.removeEventListener(eventPromises.signatureListener);
  await program.removeEventListener(eventPromises.readRespondListener);
}
