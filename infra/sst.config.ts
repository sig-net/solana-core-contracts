// @ts-nocheck
import { StackContext, Function } from "sst/constructs";

export default {
  config(_input: unknown) {
    return {
      name: "relayer-infra",
      region: process.env.AWS_REGION || "us-east-1",
      // Use default CDK bootstrap qualifier (hnb659fds)
    };
  },
  stacks(app: any) {
    app.stack(function RelayerStack({ stack }: StackContext) {
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
          tsconfig: "tsconfig.json",
        },
      } as const;

      const notifyDeposit = new Function(stack, "NotifyDeposit", {
        handler: "functions/notifyDeposit.handler",
        runtime: "nodejs20.x",
        timeout: 900,
        memorySize: 1024,
        environment: commonEnv,
        url: true,
        nodejs,
      });

      const notifyWithdrawal = new Function(stack, "NotifyWithdrawal", {
        handler: "functions/notifyWithdrawal.handler",
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
