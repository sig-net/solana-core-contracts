// @ts-nocheck

export default {
  config(_input: unknown) {
    return {
      name: "relayer-infra",
      region: process.env.AWS_REGION || "us-east-1",
      bootstrap: {
        qualifier: "relyr1",
      },
    };
  },
  stacks(app: any) {
    app.stack(async function RelayerStack({ stack }: { stack: any }) {
      const constructs = await import("sst/constructs");
      const Fn = constructs.Function;

      const commonEnv = {
        RELAYER_PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY ?? "",
        NEXT_PUBLIC_ALCHEMY_API_KEY:
          process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "",
        NEXT_PUBLIC_SEPOLIA_RPC_URL:
          process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "",
        NEXT_PUBLIC_SOLANA_RPC_URL:
          process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "",
      } as const;

      const nodejs = {
        esbuild: {
          tsconfig: "infra/tsconfig.json",
        },
      } as const;

      const notifyDeposit = new Fn(stack, "NotifyDeposit", {
        handler: "infra/functions/notifyDeposit.handler",
        runtime: "nodejs20.x",
        timeout: 900,
        memorySize: 1024,
        environment: commonEnv,
        url: true,
        nodejs,
      });

      const notifyWithdrawal = new Fn(stack, "NotifyWithdrawal", {
        handler: "infra/functions/notifyWithdrawal.handler",
        runtime: "nodejs20.x",
        timeout: 900,
        memorySize: 1024,
        environment: commonEnv,
        url: true,
        nodejs,
      });

      stack.addOutputs({
        NotifyDepositName: notifyDeposit.functionName,
        NotifyWithdrawalName: notifyWithdrawal.functionName,
        NotifyDepositUrl: notifyDeposit.url ?? "",
        NotifyWithdrawalUrl: notifyWithdrawal.url ?? "",
      });
    });
  },
};
