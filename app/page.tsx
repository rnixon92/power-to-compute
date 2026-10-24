import { book } from "@/data/ledger";
import { BoardView } from "@/components/board/BoardView";
import { MAP_H, MAP_W, statePaths } from "@/lib/geo";
import { getMarket } from "@/lib/market";
import { pinsFor } from "@/lib/pins";

export const dynamic = "force-dynamic";

export default async function Page() {
  const market = await getMarket();
  return <BoardView market={market} states={statePaths()} pins={pinsFor(book)} mapSize={[MAP_W, MAP_H]} />;
}
