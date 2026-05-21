// Admin-only shortcut block on a show detail page.
//
// Renders nothing for non-admins. For platform_admins, exposes the relevant
// management surfaces for this show — currently "Manage door staff at the
// show's venue". Phase 4b/5 will add scanner shortcut, refund/comp links here.

import { Link } from "react-router-dom";
import { ShieldCheck, Users } from "lucide-react";
import { useUserRole } from "../../hooks/useUserRole";
import { useTicketedShow } from "../../lib/firebaseTicketing";

interface AdminShowShortcutsProps {
  showId: string;
}

export default function AdminShowShortcuts({ showId }: AdminShowShortcutsProps) {
  const { isAdmin, isLoading } = useUserRole();
  const { show } = useTicketedShow(showId);

  if (isLoading || !isAdmin) return null;

  return (
    <section
      className="card-cinema p-4 space-y-3 border-amber-400/50"
      aria-label="Admin actions for this show"
    >
      <header className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-bold text-cinema-900 uppercase tracking-wide">
          Admin actions
        </h2>
      </header>

      {show?.venueId ? (
        <Link
          to={`/admin/venues/${show.venueId}/staff`}
          className="flex items-center justify-between p-3 rounded-lg bg-cinema-50 border border-cinema-200 hover:border-primary/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/15 text-primary">
              <Users className="w-4 h-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-cinema-900">Manage door staff</p>
              <p className="text-xs text-cinema-600">
                Invite a scanner for this venue or revoke existing access.
              </p>
            </div>
          </div>
          <span className="text-primary text-sm font-semibold">→</span>
        </Link>
      ) : (
        <p className="text-xs text-cinema-500">
          This show isn't linked to a venue in the ticketing database yet — door-staff
          management is per-venue, so seed the venue first via the Controller or seed
          script.
        </p>
      )}
    </section>
  );
}
