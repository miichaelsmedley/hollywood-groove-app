import { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck, Ticket, X } from 'lucide-react';
import type { OfferClaim } from '../../types/firebaseContract';
import { prizeLabel, redeemTime } from '../../hooks/useShowOffers';
import { redeemOfferClaim } from '../../lib/offers/callables';

interface RedemptionPassProps {
  claim: OfferClaim;
  showTitle?: string | null;
  isTestShow?: boolean;
  onClose: () => void;
}

export default function RedemptionPass({
  claim,
  showTitle,
  isTestShow = false,
  onClose,
}: RedemptionPassProps) {
  const [now, setNow] = useState(() => new Date());
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [localRedeemedAt, setLocalRedeemedAt] = useState<number | null>(null);
  const redeemedAt = localRedeemedAt ?? redeemTime(claim);
  const isRedeemed = claim.redeemed || Boolean(redeemedAt);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleRedeem = async () => {
    if (isRedeemed || isRedeeming) return;
    const ok = window.confirm('Mark this prize as redeemed? Staff should verify the pass before you do this.');
    if (!ok) return;
    setIsRedeeming(true);
    setRedeemError(null);
    try {
      const result = await redeemOfferClaim({
        showId: claim.showId,
        offerId: claim.offerId,
        isTestShow,
      });
      setLocalRedeemedAt(result.redeemedAt);
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : 'Could not mark as redeemed.');
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-cinema text-white">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Close redemption pass"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex min-h-screen flex-col px-5 py-10">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <div className="rounded-[2rem] border-2 border-primary bg-gradient-to-b from-cinema-900 to-black p-5 shadow-glow">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-cinema-950">
                  <Ticket className="h-6 w-6 text-cinema" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">Redemption pass</p>
                  <p className="text-sm text-white/70">{showTitle || `Show ${claim.showId}`}</p>
                </div>
              </div>
              {isRedeemed ? (
                <span className="rounded-full bg-accent-green px-3 py-1 text-xs font-black text-cinema">
                  Redeemed
                </span>
              ) : (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cinema">
                  Live
                </span>
              )}
            </div>

            <div className="space-y-4 text-center">
              <div>
                <p className="text-sm font-semibold text-white/70">Prize</p>
                <h1 className="mt-1 text-3xl font-black leading-tight">{claim.offerTitle}</h1>
                <p className="mt-2 text-sm font-semibold text-primary">
                  {prizeLabel({ prize_type: claim.prizeType, title: claim.offerTitle })}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-white/60">Winner</p>
                <p className="text-2xl font-black">{claim.displayName || 'Guest'}</p>
              </div>

              <div className="rounded-2xl border border-primary/50 bg-primary/15 px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-primary">Voucher code</p>
                <p className="mt-1 font-mono text-4xl font-black tracking-[0.18em] text-white">
                  {claim.voucherCode}
                </p>
              </div>

              <div className="overflow-hidden rounded-full border border-white/15 bg-white/10">
                <div className="h-3 w-1/3 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-primary" />
              </div>

              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-white/75">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Live verification {now.toLocaleTimeString()}</span>
              </div>
            </div>

            {redeemError && (
              <p className="mt-4 rounded-xl border border-red-400/40 bg-red-500/15 p-3 text-sm text-red-100">
                {redeemError}
              </p>
            )}

            <button
              type="button"
              onClick={handleRedeem}
              disabled={isRedeemed || isRedeeming}
              className="mt-6 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-cinema transition-colors hover:bg-primary-400 disabled:cursor-default disabled:bg-white/20 disabled:text-white/60"
            >
              <CheckCircle2 className="h-5 w-5" />
              {isRedeemed ? 'Already redeemed' : isRedeeming ? 'Marking redeemed...' : 'Mark as redeemed'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
