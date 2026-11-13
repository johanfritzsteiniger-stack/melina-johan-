import { Suspense } from "react";
import { BattleDetail } from "./battle-detail";

export default function Page({ params }: PageProps<"/battles/[id]">) {
  return (
    <Suspense fallback={null}>
      <BattleDetail params={params} />
    </Suspense>
  );
}
