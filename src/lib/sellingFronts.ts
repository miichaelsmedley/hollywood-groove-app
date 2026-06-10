import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { firestoreTicketing } from "./ticketing/client";
import type { SellingFrontId, TicketSellingFront } from "../types/ticketingContract";

export type SellingFrontBrand = Omit<TicketSellingFront, "createdAt" | "updatedAt"> & {
  id: SellingFrontId;
  createdAt?: TicketSellingFront["createdAt"];
  updatedAt?: TicketSellingFront["updatedAt"];
};

const DEFAULT_SELLING_FRONTS: Record<string, SellingFrontBrand> = {
  hollywood_groove: {
    id: "hollywood_groove",
    displayName: "Hollywood Groove",
    slug: "hollywood-groove",
    active: true,
    displayOrder: 10,
    defaultCurrency: "AUD",
    publicSiteUrl: "https://app.hollywoodgroove.com.au",
    supportEmail: "bookings@hollywoodgroove.com.au",
    domain: "app.hollywoodgroove.com.au",
    ticketBasePath: "/tickets",
    brandTagline: "Live trivia, music and ticketed events",
    merchantDisplayName: "The Adele Show",
    merchantOfRecord: "adele_show",
    theme: {
      primaryColor: "#f59e0b",
      accentColor: "#fbbf24",
      backgroundColor: "#070707",
      surfaceColor: "#111827",
      textColor: "#ffffff",
    },
  },
  adele_show: {
    id: "adele_show",
    displayName: "The Adele Show",
    slug: "adele-show",
    active: true,
    displayOrder: 20,
    defaultCurrency: "AUD",
    publicSiteUrl: "https://adeleshow.com.au",
    supportEmail: "info@adeleshow.com.au",
    domain: "adeleshow.com.au",
    ticketBasePath: "/tickets",
    brandTagline: "A night of Adele's biggest songs, live",
    merchantDisplayName: "The Adele Show",
    merchantOfRecord: "adele_show",
    theme: {
      primaryColor: "#d8b15f",
      accentColor: "#f3d9a4",
      backgroundColor: "#080605",
      surfaceColor: "#18110d",
      textColor: "#fffaf0",
    },
  },
};

function currentLocation() {
  if (typeof window === "undefined") {
    return { hostname: "", origin: "", search: "", pathname: "" };
  }
  return {
    hostname: window.location.hostname,
    origin: window.location.origin,
    search: window.location.search,
    pathname: window.location.pathname,
  };
}

export function resolveSellingFrontId(
  host = currentLocation().hostname,
  search = currentLocation().search
): SellingFrontId {
  const params = new URLSearchParams(search);
  const front = params.get("front") || params.get("sellingFrontId");
  if (front) return front as SellingFrontId;

  const normalisedHost = host.toLowerCase();
  if (normalisedHost === "adeleshow.com.au" || normalisedHost.endsWith(".adeleshow.com.au")) {
    return "adele_show";
  }
  return "hollywood_groove";
}

export function getDefaultSellingFrontBrand(frontId: SellingFrontId): SellingFrontBrand {
  return DEFAULT_SELLING_FRONTS[String(frontId)] ?? {
    ...DEFAULT_SELLING_FRONTS.hollywood_groove,
    id: frontId,
  };
}

export function isWhiteLabelTicketingFront(frontId = resolveSellingFrontId()): boolean {
  return frontId !== "hollywood_groove";
}

export function getTicketBasePath(frontId = resolveSellingFrontId()): string {
  return getDefaultSellingFrontBrand(frontId).ticketBasePath || "/tickets";
}

export function getTicketWalletPath(frontId = resolveSellingFrontId()): string {
  return isWhiteLabelTicketingFront(frontId) ? `${getTicketBasePath(frontId)}/my` : getTicketBasePath(frontId);
}

export function getTicketEventPath(showId: string, frontId = resolveSellingFrontId()): string {
  return isWhiteLabelTicketingFront(frontId)
    ? `${getTicketBasePath(frontId)}/event/${showId}`
    : `/event/${showId}`;
}

export function getTicketSuccessUrl(frontId = resolveSellingFrontId()): string | undefined {
  const { origin } = currentLocation();
  if (!origin) return undefined;
  return `${origin}${getTicketBasePath(frontId)}/success?session_id={CHECKOUT_SESSION_ID}`;
}

export function getTicketCancelUrl(frontId = resolveSellingFrontId()): string | undefined {
  const { origin } = currentLocation();
  if (!origin) return undefined;
  return `${origin}${getTicketBasePath(frontId)}/cancelled`;
}

export function getHomePath(frontId = resolveSellingFrontId()): string {
  return isWhiteLabelTicketingFront(frontId) ? "/" : "/";
}

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
