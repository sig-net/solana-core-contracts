import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const client = new LambdaClient({});

export async function handler(event: any) {
  const body =
    typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  const { requestId, erc20Address, transactionParams } = body ?? {};
  if (!requestId || !erc20Address || !transactionParams) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required fields" }),
    };
  }
  try {
    await client.send(
      new InvokeCommand({
        FunctionName: process.env.WITHDRAW_WORKER_NAME!,
        InvocationType: "Event",
        Payload: Buffer.from(
          JSON.stringify({ requestId, erc20Address, transactionParams })
        ),
      })
    );
    return { statusCode: 202, body: JSON.stringify({ accepted: true }) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { statusCode: 500, body: JSON.stringify({ error: msg }) };
  }
}
