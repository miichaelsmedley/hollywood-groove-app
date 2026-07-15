import { useMemo } from 'react';
import { getShowPath, getTestShowPath } from '../lib/mode';
import type { OfferAward, OfferClaim, ShowMeta, ShowOffer } from '../types/firebaseContract';
import { useRtdbValue } from './useRtdbValue';

function showPath(showId: string, isTestShow: boolean, suffix: string): string {
  return isTestShow ? getTestShowPath(showId, suffix) : getShowPath(showId, suffix);
}

function entriesFromRecord<T>(record: Record<string, T> | null): Array<T & { id: string }> {
  if (!record) return [];
  return Object.entries(record).map(([id, value]) => ({ ...(value as T), id }));
}

export function prizeLabel(offer: Pick<ShowOffer, 'prize_type' | 'custom_prize_text' | 'title'>): string {
  if (offer.prize_type === 'venue_drink') return 'Venue drink';
  if (offer.prize_type === 'custom') return offer.custom_prize_text?.trim() || offer.title || 'Custom prize';
  return 'Free ticket to another show';
}

export function claimTime(claim: OfferClaim): number {
  return claim.claimedAt ?? claim.claimed_at ?? 0;
}

export function redeemTime(claim: OfferClaim): number | null {
  return claim.redeemedAt ?? claim.redeemed_at ?? null;
}

export function useShowOffers(showId: string | null, uid: string | null, isTestShow = false) {
  const offersPath = showId ? showPath(showId, isTestShow, 'offers') : null;
  const awardsPath = showId && uid ? showPath(showId, isTestShow, `offer_awards/${uid}`) : null;
  const claimsPath = showId && uid ? showPath(showId, isTestShow, `offer_claims/${uid}`) : null;
  const metaPath = showId ? showPath(showId, isTestShow, 'meta') : null;

  const offersState = useRtdbValue<Record<string, ShowOffer>>(offersPath);
  const awardsState = useRtdbValue<Record<string, OfferAward>>(awardsPath);
  const claimsState = useRtdbValue<Record<string, OfferClaim>>(claimsPath);
  const metaState = useRtdbValue<ShowMeta>(metaPath);

  const offers = useMemo(() => entriesFromRecord(offersState.value), [offersState.value]);
  const awards = useMemo(() => entriesFromRecord(awardsState.value), [awardsState.value]);
  const claims = useMemo(() => entriesFromRecord(claimsState.value), [claimsState.value]);

  const eligibleOffers = useMemo(() => {
    const claimsByOffer = new Map(claims.map((claim) => [claim.offerId || claim.id, claim]));
    const awardsByOffer = new Map(awards.map((award) => [award.offerId || award.id, award]));
    return offers
      .filter((offer) => offer.active === true)
      .filter((offer) => {
        if (claimsByOffer.has(offer.id)) return true;
        if (offer.eligibility === 'broadcast') return true;
        return awardsByOffer.has(offer.id);
      })
      .map((offer) => ({
        offer,
        award: awardsByOffer.get(offer.id) ?? null,
        claim: claimsByOffer.get(offer.id) ?? null,
      }));
  }, [awards, claims, offers]);

  return {
    showTitle: metaState.value?.title ?? null,
    offers,
    awards,
    claims,
    eligibleOffers,
    isLoading: offersState.loading || awardsState.loading || claimsState.loading,
    error: offersState.error ?? awardsState.error ?? claimsState.error ?? metaState.error,
  };
}

export function useMyOfferClaims(uid: string | null, isTestShow = false) {
  const path = uid ? `${isTestShow ? 'test/' : ''}offer_claims_by_uid/${uid}` : null;
  const state = useRtdbValue<Record<string, OfferClaim>>(path);
  const claims = useMemo(
    () => entriesFromRecord(state.value).sort((a, b) => claimTime(b) - claimTime(a)),
    [state.value]
  );

  return {
    claims,
    isLoading: state.loading,
    error: state.error,
  };
}
