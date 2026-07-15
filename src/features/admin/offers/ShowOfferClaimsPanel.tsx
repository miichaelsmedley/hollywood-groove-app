import { useMemo, useState } from 'react';
import { Gift, Search, ShieldCheck, Ticket } from 'lucide-react';
import { getShowPath, getTestShowPath } from '../../../lib/mode';
import { useRtdbValue } from '../../../hooks/useRtdbValue';
import type { OfferClaim, ShowMeta, ShowOffer } from '../../../types/firebaseContract';
import { claimTime, prizeLabel, redeemTime } from '../../../hooks/useShowOffers';
import { EmptyState, SectionHeader } from '../../../components/admin/ui';

type ClaimRow = OfferClaim & {
  id: string;
};

function pathFor(showId: string, isTestShow: boolean, suffix: string): string {
  return isTestShow ? getTestShowPath(showId, suffix) : getShowPath(showId, suffix);
}

function flattenClaims(value: Record<string, Record<string, OfferClaim>> | null): ClaimRow[] {
  if (!value) return [];
  return Object.entries(value).flatMap(([uid, byOffer]) =>
    Object.entries(byOffer ?? {}).map(([offerId, claim]) => ({
      ...claim,
      uid: claim.uid || uid,
      offerId: claim.offerId || offerId,
      id: `${uid}:${offerId}`,
    }))
  );
}

export default function ShowOfferClaimsPanel() {
  const [showIdInput, setShowIdInput] = useState('');
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  const [isTestShow, setIsTestShow] = useState(false);

  const showId = selectedShowId?.trim() || null;
  const metaState = useRtdbValue<ShowMeta>(showId ? pathFor(showId, isTestShow, 'meta') : null);
  const offersState = useRtdbValue<Record<string, ShowOffer>>(showId ? pathFor(showId, isTestShow, 'offers') : null);
  const claimsState = useRtdbValue<Record<string, Record<string, OfferClaim>>>(
    showId ? pathFor(showId, isTestShow, 'offer_claims') : null
  );

  const claims = useMemo(
    () => flattenClaims(claimsState.value).sort((a, b) => claimTime(b) - claimTime(a)),
    [claimsState.value]
  );
  const offers = offersState.value ?? {};

  const handleLoad = () => {
    const trimmed = showIdInput.trim();
    if (!trimmed) return;
    setSelectedShowId(trimmed);
  };

  return (
    <section className="space-y-3 rounded-2xl border border-cinema-200 bg-cinema-50 p-4">
      <SectionHeader Icon={Gift} title="In-show prize claims" />
      <p className="text-sm text-cinema-600">
        RTDB-only voucher reconciliation. This does not touch the ticketing database.
      </p>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <label className="sr-only" htmlFor="offer-show-id">Show ID</label>
        <input
          id="offer-show-id"
          type="text"
          value={showIdInput}
          onChange={(event) => setShowIdInput(event.target.value)}
          placeholder="Firebase show ID"
          className="min-h-11 rounded-xl border border-cinema-200 bg-cinema-100 px-3 text-sm text-cinema-900 outline-none focus:border-primary"
        />
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-cinema-200 bg-cinema-100 px-3 text-sm font-semibold text-cinema-700">
          <input
            type="checkbox"
            checked={isTestShow}
            onChange={(event) => setIsTestShow(event.target.checked)}
            className="h-4 w-4 rounded border-cinema-300 text-primary focus:ring-primary"
          />
          Test
        </label>
        <button
          type="button"
          onClick={handleLoad}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-cinema hover:bg-primary-400"
        >
          <Search className="h-4 w-4" />
          Load
        </button>
      </div>

      {showId && (
        <div className="rounded-xl border border-cinema-200 bg-cinema-100 p-3 text-sm text-cinema-600">
          <span className="font-bold text-cinema-900">
            {metaState.value?.title || `Show ${showId}`}
          </span>
          {isTestShow ? ' · test mode' : ''}
        </div>
      )}

      {claimsState.loading ? (
        <EmptyState>Loading prize claims...</EmptyState>
      ) : claims.length === 0 ? (
        <EmptyState>No prize claims for this show yet.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-cinema-200">
          {claims.map((claim) => {
            const offer = offers[claim.offerId];
            const redeemed = claim.redeemed || Boolean(redeemTime(claim));
            return (
              <div
                key={claim.id}
                className="grid gap-2 border-b border-cinema-200 bg-cinema-100 p-3 last:border-b-0 md:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-cinema-900">{claim.displayName || 'Guest'}</p>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                      {claim.voucherCode}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      redeemed ? 'bg-accent-green/15 text-accent-green' : 'bg-white/10 text-cinema-600'
                    }`}>
                      {redeemed ? 'Redeemed' : 'Unredeemed'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-cinema-700">{claim.offerTitle || offer?.title || 'Show prize'}</p>
                  <p className="mt-1 text-xs text-cinema-500">
                    {prizeLabel({
                      prize_type: claim.prizeType ?? offer?.prize_type,
                      custom_prize_text: offer?.custom_prize_text,
                      title: claim.offerTitle || offer?.title || 'Show prize',
                    })}
                    {claimTime(claim) ? ` · claimed ${new Date(claimTime(claim)).toLocaleString()}` : ''}
                    {redeemTime(claim) ? ` · redeemed ${new Date(redeemTime(claim) as number).toLocaleString()}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-cinema-500">
                  {redeemed ? <ShieldCheck className="h-5 w-5 text-accent-green" /> : <Ticket className="h-5 w-5 text-primary" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
