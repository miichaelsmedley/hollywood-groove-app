import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { firestoreTicketing } from "./ticketing/client";
import {
  getDefaultSellingFrontBrand,
  resolveSellingFrontId,
  type SellingFrontBrand,
} from "./sellingFronts";
import type { SellingFrontId, TicketSellingFront } from "../types/ticketingContract";

export function useSellingFrontBrand(frontId?: SellingFrontId) {
  const resolvedFrontId = frontId ?? resolveSellingFrontId();
  const fallback = useMemo(
    () => getDefaultSellingFrontBrand(resolvedFrontId),
    [resolvedFrontId]
  );
  const [brand, setBrand] = useState<SellingFrontBrand>(fallback);

  useEffect(() => {
    setBrand(fallback);
    const unsub = onSnapshot(
      doc(firestoreTicketing, "sellingFronts", String(resolvedFrontId)),
      (snap) => {
        if (!snap.exists()) {
          setBrand(fallback);
          return;
        }
        const remote = snap.data() as TicketSellingFront;
        setBrand({
          ...fallback,
          ...remote,
          theme: {
            ...fallback.theme,
            ...remote.theme,
          },
          logo: {
            ...fallback.logo,
            ...remote.logo,
          },
          id: resolvedFrontId,
        });
      },
      () => setBrand(fallback)
    );
    return () => unsub();
  }, [fallback, resolvedFrontId]);

  return brand;
}
