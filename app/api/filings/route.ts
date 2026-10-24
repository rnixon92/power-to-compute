import { latestFilings } from "@/lib/edgar";

export const dynamic = "force-dynamic";

export async function GET() {
  const filings = await latestFilings();
  return Response.json({ filings });
}
