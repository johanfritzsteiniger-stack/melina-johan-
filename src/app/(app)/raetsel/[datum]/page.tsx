import { Suspense } from "react";
import { RaetselSpiel } from "./spiel";

export default function Page({ params }: PageProps<"/raetsel/[datum]">) {
  return (
    <Suspense fallback={null}>
      <RaetselSpiel params={params} />
    </Suspense>
  );
}
