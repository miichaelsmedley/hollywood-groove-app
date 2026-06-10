import { collection, doc, limit, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { firestoreTicketing } from "../client";
import { useFirestoreCollection } from "./firestore";
import type { VenueStaffRole } from "../callables";
import type { TicketVenue } from "../../../types/ticketingContract";

export interface VenueEligibleStaff {
  uid: string;
  role: VenueStaffRole;
  grantedBy?: string;
  grantedAt?: unknown;
  expiresAt?: unknown;
  invitedEmail?: string | null;
}

export interface VenueStaffInvite {
  email: string;
  emailHash: string;
  role: VenueStaffRole;
  expiresAt?: unknown;
  invitedByUid?: string;
  invitedAt?: unknown;
}

export interface UseVenueStaffResult {
  staff: Array<VenueEligibleStaff & { id: string }>;
  invites: Array<VenueStaffInvite & { id: string }>;
  loading: boolean;
  error: Error | null;
}

export function useVenueStaff(
  venueId: string | undefined,
): UseVenueStaffResult {
  const [state, setState] = useState<UseVenueStaffResult>({
    staff: [],
    invites: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!venueId) {
      setState({ staff: [], invites: [], loading: false, error: null });
      return;
    }
    const venueRef = doc(firestoreTicketing, "venues", venueId);
    const staffUnsub = onSnapshot(
      collection(venueRef, "eligibleStaff"),
      (snap) => {
        const staff = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as VenueEligibleStaff),
        }));
        setState((prev) => ({ ...prev, staff, loading: false, error: null }));
      },
      (err) => setState((prev) => ({ ...prev, error: err, loading: false })),
    );
    const invitesUnsub = onSnapshot(
      collection(venueRef, "eligibleStaffInvites"),
      (snap) => {
        const invites = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as VenueStaffInvite),
        }));
        setState((prev) => ({ ...prev, invites }));
      },
      // Non-admins can't read invites; swallow rather than surfacing as an
      // error so the staff list still renders.
      () => {},
    );
    return () => {
      staffUnsub();
      invitesUnsub();
    };
  }, [venueId]);

  return state;
}

export interface UseAdminVenuesResult {
  venues: Array<TicketVenue & { id: string }>;
  loading: boolean;
  error: Error | null;
}

export function useAdminVenues(): UseAdminVenuesResult {
  const venuesQuery = useMemo(
    () =>
      query(
        collection(firestoreTicketing, "venues"),
        orderBy("name", "asc"),
        limit(100),
      ),
    [],
  );
  const { items, loading, error } =
    useFirestoreCollection<TicketVenue>(venuesQuery);
  return { venues: items, loading, error };
}
