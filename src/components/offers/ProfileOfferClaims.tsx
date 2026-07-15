import { useState } from 'react';
import { Gift, ShieldCheck, Ticket } from 'lucide-react';
import type { OfferClaim } from '../../types/firebaseContract';
import { claimTime, prizeLabel, redeemTime, useMyOfferClaims } from '../../hooks/useShowOffers';
import RedemptionPass from './RedemptionPass';

interface ProfileOfferClaimsProps {
  uid: string;
  isTestShow?: boolean;
}

export default function ProfileOfferClaims({ uid, isTestShow = false }: ProfileOfferClaimsProps) {
  const { claims, isLoading, error } = useMyOfferClaims(uid, isTestShow);
  const [activeClaim, setActiveClaim] = useState<OfferClaim | null>(null);
  const visibleClaims = claims.filter((claim) => !(claim.redeemed || Boolean(redeemTime(claim))));

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-cinema-200 bg-cinema-50 p-4 text-sm text-cinema-500">
        Loading prizes...
      </div>
    );
  }

  if (error || visibleClaims.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-2xl border border-primary/30 bg-cinema-50 p-5">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-sm font-black text-cinema-900">Prize wallet</h2>
          <p className="text-xs text-cinema-500">Unredeemed show prizes stay here.</p>
        </div>
      </div>

      <div className="space-y-2">
        {visibleClaims.map((claim) => (
          <button
            key={`${claim.showId}:${claim.offerId}`}
            type="button"
            onClick={() => setActiveClaim(claim)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-cinema-200 bg-cinema-100 p-3 text-left transition-colors hover:border-primary/60"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Ticket className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-cinema-900">{claim.offerTitle}</p>
                <p className="text-xs text-cinema-500">
                  {prizeLabel({ prize_type: claim.prizeType, title: claim.offerTitle })}
                  {claimTime(claim) ? ` · ${new Date(claimTime(claim)).toLocaleDateString()}` : ''}
                </p>
              </div>
            </div>
            <ShieldCheck className="h-5 w-5 flex-shrink-0 text-primary" />
          </button>
        ))}
      </div>

      {activeClaim && (
        <RedemptionPass
          claim={activeClaim}
          showTitle={`Show ${activeClaim.showId}`}
          isTestShow={isTestShow}
          onClose={() => setActiveClaim(null)}
        />
      )}
    </section>
  );
}
