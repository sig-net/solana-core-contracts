import { handleWithdrawal } from "@/lib/relayer/handlers";

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
    const result = await handleWithdrawal({
      requestId,
      erc20Address,
      transactionParams,
    });
    if (!result.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: result.error }) };
    }
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { statusCode: 500, body: JSON.stringify({ error: msg }) };
  }
}
