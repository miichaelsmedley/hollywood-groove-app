import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { firestoreTicketing } from "./client";

export interface SaveVenueInput {
  name: string;
  address?: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  capacity?: number;
  public: boolean;
  stripeConnectAccountId?: string | null;
}

// Set how many tickets a single order may contain for one ticket type. Firestore
// rules restrict shows/{showId}/ticketTypes writes to platform_admin, and the
// server (createCheckoutSession) re-enforces maxPerOrder at checkout, so this is
// the per-show control behind the buyer quantity picker -- not a security gate.
export async function updateTicketTypeMaxPerOrder(
  showId: string,
  ticketTypeId: string,
  maxPerOrder: number,
): Promise<void> {
  const value = Math.floor(maxPerOrder);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error("Max per order must be a whole number of at least 1.");
  }
  if (value > 1000) {
    throw new Error("Max per order can't exceed 1000 per order.");
  }
  await updateDoc(
    doc(firestoreTicketing, "shows", showId, "ticketTypes", ticketTypeId),
    { maxPerOrder: value, updatedAt: serverTimestamp() },
  );
}

export function cleanVenuePayload(
  input: SaveVenueInput,
): Record<string, unknown> {
  const contact = {
    name: input.contact?.name?.trim() || undefined,
    email: input.contact?.email?.trim() || undefined,
    phone: input.contact?.phone?.trim() || undefined,
  };
  const hasContact = Boolean(contact.name || contact.email || contact.phone);

  return {
    name: input.name.trim(),
    address: input.address?.trim() || "",
    public: input.public,
    capacity:
      typeof input.capacity === "number" && Number.isFinite(input.capacity)
        ? Math.max(0, Math.floor(input.capacity))
        : null,
    contact: hasContact ? contact : {},
    stripeConnectAccountId: input.stripeConnectAccountId?.trim() || null,
    updatedAt: serverTimestamp(),
  };
}

export async function saveVenue(
  input: SaveVenueInput,
  venueId?: string,
): Promise<string> {
  const payload = cleanVenuePayload(input);
  if (venueId) {
    await updateDoc(doc(firestoreTicketing, "venues", venueId), payload);
    return venueId;
  }

  const created = await addDoc(collection(firestoreTicketing, "venues"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return created.id;
}
