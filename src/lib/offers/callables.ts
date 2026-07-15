import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import app from '../firebase';
import type { OfferClaim } from '../../types/firebaseContract';

const functions = getFunctions(app, 'asia-southeast1');

export interface ClaimOfferInput {
  showId: string;
  offerId: string;
  isTestShow?: boolean;
}

export type ClaimOfferResult = OfferClaim;

export interface RedeemOfferResult {
  ok: true;
  redeemedAt: number;
}

const claimOfferCallable = httpsCallable<ClaimOfferInput, ClaimOfferResult>(
  functions,
  'claimOffer'
);

const redeemOfferClaimCallable = httpsCallable<ClaimOfferInput, RedeemOfferResult>(
  functions,
  'redeemOfferClaim'
);

export async function claimOffer(input: ClaimOfferInput): Promise<ClaimOfferResult> {
  const response = await claimOfferCallable(input);
  return response.data;
}

export async function redeemOfferClaim(input: ClaimOfferInput): Promise<RedeemOfferResult> {
  const response = await redeemOfferClaimCallable(input);
  return response.data;
}
