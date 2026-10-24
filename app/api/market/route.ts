import { getMarket } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  const book = await getMarket({ force: fresh });
  return Response.json(book);
}
