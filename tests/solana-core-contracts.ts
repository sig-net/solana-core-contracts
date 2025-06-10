import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaCoreContracts } from "../target/types/solana_core_contracts";
import { BN } from "@coral-xyz/anchor";
import { confirmTransaction, getTransactionReturnValue } from "../utils/solana";
import { assert } from "chai";

describe("solana-core-contracts", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .solanaCoreContracts as Program<SolanaCoreContracts>;

  it("Should process ethereum transaction", async () => {
    const ethereumTx = {
      toAddress: [
        0x70, 0x99, 0x7e, 0xda, 0x9c, 0xf9, 0x4d, 0x39, 0x60, 0x1a, 0x95, 0x6e,
        0xd5, 0x27, 0x4a, 0x8c, 0x7e, 0x69, 0x2d, 0x2c,
      ],
      value: new BN("1000000000000000000"),
      gasLimit: new BN("21000"),
      maxFeePerGas: new BN("20000000000"),
      maxPriorityFeePerGas: new BN("2000000000"),
      nonce: new BN(0),
      chainId: new BN(1),
      data: Buffer.from([]),
    };

    const result = await program.methods
      .processEthereumTransaction(ethereumTx)
      .rpc();

    await confirmTransaction(program.provider.connection, result);

    const returnData = await getTransactionReturnValue<Uint8Array>(
      program.provider.connection,
      result
    );

    if (returnData) {
      const uint8Array = Array.from(returnData);

      console.log("uint8Array:", uint8Array);

      const expectedValues = [
        182, 236, 128, 78, 193, 145, 160, 90, 5, 124, 126, 14, 126, 158, 184,
        110, 79, 40, 181, 151, 178, 171, 204, 215, 72, 218, 3, 38, 116, 111,
        175, 255,
      ];

      const arraysMatch =
        uint8Array.length === expectedValues.length &&
        uint8Array.every((val, index) => val === expectedValues[index]);

      assert.isTrue(arraysMatch);
    }
  });
});
