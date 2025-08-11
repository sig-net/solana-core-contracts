import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const client = new LambdaClient({});

export async function handler(event: any) {
  const body =
    typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  const { userAddress, erc20Address, ethereumAddress } = body ?? {};
  if (!userAddress || !erc20Address || !ethereumAddress) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required fields" }),
    };
  }
  try {
    // Async invoke worker; return 202 immediately
    await client.send(
      new InvokeCommand({
        FunctionName: process.env.DEPOSIT_WORKER_NAME!,
        InvocationType: "Event",
        Payload: Buffer.from(
          JSON.stringify({ userAddress, erc20Address, ethereumAddress })
        ),
      })
    );
    return { statusCode: 202, body: JSON.stringify({ accepted: true }) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { statusCode: 500, body: JSON.stringify({ error: msg }) };
  }
}
