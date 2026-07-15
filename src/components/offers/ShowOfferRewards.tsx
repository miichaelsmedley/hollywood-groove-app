import { useMemo, useState } from 'react';
import { Gift, ShieldCheck, Ticket, Trophy } from 'lucide-react';
import { useAuthUser } from '../../features/auth/useAuthUser';
import type { OfferClaim } from '../../types/firebaseContract';
import { prizeLabel } from '../../hooks/useShowOffers';
import { useShowOffers } from '../../hooks/useShowOffers';
import { claimOffer } from '../../lib/offers/callables';
import RedemptionPass from './RedemptionPass';

interface ShowOfferRewardsProps {
  showId: string;
  isTestShow?: boolean;
  floating?: boolean;
}

function eligibilityLabel(value?: string): string {
  if (value === 'set_winner') return 'You won this set';
  if (value === 'night_winner') return 'You won the night';
  return 'Tonight offer';
}

export default function ShowOfferRewards({
  showId,
  isTestShow = false,
  floating = false,
}: ShowOfferRewardsProps) {
  const authUser = useAuthUser();
  const uid = authUser?.uid ?? null;
  const { eligibleOffers, showTitle } = useShowOffers(showId, uid, isTestShow);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeClaim, setActiveClaim] = useState<OfferClaim | null>(null);

  const nextReward = useMemo(() => {
    return eligibleOffers.find((entry) => !entry.claim?.redeemed) ?? eligibleOffers[0] ?? null;
  }, [eligibleOffers]);

  if (!uid || !nextReward) return null;

  const { offer, award, claim } = nextReward;
  const claimed = Boolean(claim);
  const redeemed = Boolean(claim?.redeemed || claim?.redeemed_at || claim?.redeemedAt);
  const isWinnerOffer = offer.eligibility === 'set_winner' || offer.eligibility === 'night_winner';

  const handleClaim = async () => {
    if (claim) {
      setActiveClaim(claim);
      return;
    }

    setBusyOfferId(offer.id);
    setError(null);
    try {
      const result = await claimOffer({
        showId,
        offerId: offer.id,
        isTestShow,
      });
      setActiveClaim(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not claim this offer.');
    } finally {
      setBusyOfferId(null);
    }
  };

  const card = (
    <section
      className={[
        'rounded-2xl border border-primary/50 bg-cinema-50 p-4 shadow-glow',
        floating ? 'mx-auto w-[calc(100%-1.5rem)] max-w-md' : '',
      ].join(' ')}
      aria-label="Show offer"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          {isWinnerOffer ? <Trophy className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            {eligibilityLabel(offer.eligibility)}
          </p>
          <h2 className="mt-1 text-base font-black text-cinema-900">{offer.title || 'Show prize'}</h2>
          <p className="mt-1 text-sm text-cinema-600">
            {offer.description || prizeLabel(offer)}
          </p>
          {award?.sourceWinnerPoints ? (
            <p className="mt-2 text-xs font-semibold text-cinema-500">
              Winning score: {award.sourceWinnerPoints.toLocaleString()} pts
            </p>
          ) : null}
          {redeemed ? (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent-green/15 px-2 py-1 text-xs font-bold text-accent-green">
              <ShieldCheck className="h-3.5 w-3.5" />
              Redeemed
            </p>
          ) : null}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleClaim}
        disabled={busyOfferId === offer.id}
        className="mt-4 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-cinema transition-colors hover:bg-primary-400 disabled:cursor-wait disabled:opacity-70"
      >
        <Ticket className="h-4 w-4" />
        {busyOfferId === offer.id
          ? 'Claiming...'
          : claimed
            ? redeemed ? 'View redeemed pass' : 'Show redemption pass'
            : 'Claim prize'}
      </button>
    </section>
  );

  return (
    <>
      {floating ? (
        <div className="fixed inset-x-0 bottom-24 z-40 px-3">
          {card}
        </div>
      ) : card}
      {activeClaim && (
        <RedemptionPass
          claim={activeClaim}
          showTitle={showTitle}
          isTestShow={isTestShow}
          onClose={() => setActiveClaim(null)}
        />
      )}
    </>
  );
}
