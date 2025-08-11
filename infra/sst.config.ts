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
    // Set sensible defaults for all functions
    app.setDefaultFunctionProps({
      runtime: "nodejs20.x",
      nodejs: {
        format: "cjs",
        esbuild: {
          tsconfig: "tsconfig.json",
        },
      },
    });

    app.stack(function RelayerStack({ stack }: StackContext) {
      // Simple env injection (works with infra/.env and deploy script)
      const commonEnv = {
        RELAYER_PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY ?? "",
        NEXT_PUBLIC_ALCHEMY_API_KEY:
          process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "",
        NEXT_PUBLIC_SEPOLIA_RPC_URL:
          process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "",
        NEXT_PUBLIC_SOLANA_RPC_URL:
          process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "",
      } as const;

      const notifyDeposit = new Function(stack, "NotifyDeposit", {
        handler: "functions/notifyDeposit.handler",
        timeout: 180,
        memorySize: 1024,
        logRetention: "one_week",
        url: {
          cors: {
            allowedOrigins: ["*"],
            allowedMethods: ["POST"],
          },
        },
        environment: commonEnv,
      });

      const notifyWithdrawal = new Function(stack, "NotifyWithdrawal", {
        handler: "functions/notifyWithdrawal.handler",
        timeout: 180,
        memorySize: 1024,
        logRetention: "one_week",
        url: {
          cors: {
            allowedOrigins: ["*"],
            allowedMethods: ["POST"],
          },
        },
        environment: commonEnv,
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
