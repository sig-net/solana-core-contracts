import { handleDeposit } from "@/lib/relayer/handlers";

export async function handler(event: any) {
  const body = typeof event === "string" ? JSON.parse(event) : event;
  const { userAddress, erc20Address, ethereumAddress } = body ?? {};
  if (!userAddress || !erc20Address || !ethereumAddress) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required fields" }),
    };
  }
  try {
    const result = await handleDeposit({
      userAddress,
      erc20Address,
      ethereumAddress,
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
