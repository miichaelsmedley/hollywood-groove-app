// Compatibility barrel for the ticketing modules.
//
// Keep this path stable so existing page/component imports do not churn while
// the implementation lives under lib/ticketing/.

export * from "./ticketing/adminWrites";
export * from "./ticketing/callables";
export * from "./ticketing/client";
export * from "./ticketing/hooks/admin";
export * from "./ticketing/hooks/buyer";
export * from "./ticketing/hooks/firestore";
export * from "./ticketing/hooks/venue";
export * from "./ticketing/pricing";
export * from "./ticketing/promoCodes";
export type {
  IssuedTicket,
  TicketHolderSnapshot,
  TicketOrder,
  TicketType,
  TicketVenue,
  TicketedShow,
} from "../types/ticketingContract";
