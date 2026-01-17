/**
 * ShareButton Component
 *
 * A floating or inline button to trigger photo sharing.
 * Integrates with ShareMoment and star tracking.
 */

import { useState, useEffect } from 'react';
import { Camera, Sparkles, X, Star } from 'lucide-react';
import ShareMoment from './ShareMoment';
import { recordSocialShare, getSocialShareStats } from '../lib/engagementService';
import { useUser } from '../contexts/UserContext';

interface ShareButtonProps {
  variant?: 'floating' | 'inline' | 'compact';
  showName?: string;
  venueName?: string;
  shareType?: 'photo' | 'achievement' | 'trivia_win' | 'show_moment';
  className?: string;
}

export default function ShareButton({
  variant = 'inline',
  showName,
  venueName,
  shareType = 'photo',
  className = '',
}: ShareButtonProps) {
  const { userProfile } = useUser();
  const [showCamera, setShowCamera] = useState(false);
  const [canShare, setCanShare] = useState(true);

  // Check if user can share more today
  useEffect(() => {
    if (userProfile?.uid) {
      getSocialShareStats(userProfile.uid).then(stats => {
        setCanShare(stats.canShareMore);
      });
    }
  }, [userProfile?.uid]);

  const handleShareComplete = async () => {
    if (!userProfile?.uid) return;

    const result = await recordSocialShare(userProfile.uid, shareType);
    if (result.success) {
      setCanShare(result.dailySharesUsed < result.maxDailyShares);
    }
  };

  // Floating variant (FAB style)
  if (variant === 'floating') {
    return (
      <>
        <button
          onClick={() => setShowCamera(true)}
          disabled={!canShare}
          className={`fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:hover:scale-100 ${className}`}
        >
          <Camera className="w-6 h-6" />
          {canShare && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent-green rounded-full flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </span>
          )}
        </button>

        {showCamera && (
          <ShareMoment
            showName={showName}
            venueName={venueName}
            onClose={() => setShowCamera(false)}
            onShareComplete={handleShareComplete}
          />
        )}
      </>
    );
  }

  // Compact variant (icon only)
  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={() => setShowCamera(true)}
          disabled={!canShare}
          className={`p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition disabled:opacity-50 ${className}`}
          title={canShare ? 'Share a moment' : 'Daily limit reached'}
        >
          <Camera className="w-5 h-5" />
        </button>

        {showCamera && (
          <ShareMoment
            showName={showName}
            venueName={venueName}
            onClose={() => setShowCamera(false)}
            onShareComplete={handleShareComplete}
          />
        )}
      </>
    );
  }

  // Inline variant (full button)
  return (
    <>
      <button
        onClick={() => setShowCamera(true)}
        disabled={!canShare}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 transition disabled:opacity-50 ${className}`}
      >
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Camera className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold text-cinema-800">Share a Moment</div>
          <div className="text-xs text-cinema-500">
            {canShare ? (
              <>Earn <span className="text-primary font-semibold">0.5 stars</span> per share</>
            ) : (
              'Come back tomorrow for more!'
            )}
          </div>
        </div>
        {canShare && (
          <Sparkles className="w-5 h-5 text-primary" />
        )}
      </button>

      {showCamera && (
        <ShareMoment
          showName={showName}
          venueName={venueName}
          onClose={() => setShowCamera(false)}
          onShareComplete={handleShareComplete}
        />
      )}
    </>
  );
}

/**
 * SharePrompt Component
 *
 * A modal that appears after achievements/wins to encourage sharing.
 */
interface SharePromptProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  showName?: string;
  venueName?: string;
  shareType?: 'photo' | 'achievement' | 'trivia_win' | 'show_moment';
}

export function SharePrompt({
  isOpen,
  onClose,
  title,
  subtitle,
  showName,
  venueName,
  shareType = 'achievement',
}: SharePromptProps) {
  const { userProfile } = useUser();
  const [showCamera, setShowCamera] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!isOpen || dismissed) return null;

  const handleShareComplete = async () => {
    if (!userProfile?.uid) return;
    await recordSocialShare(userProfile.uid, shareType);
    setShowCamera(false);
    onClose();
  };

  const handleDismiss = () => {
    setDismissed(true);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-4">
        <div className="w-full max-w-md bg-cinema-50 rounded-3xl p-6 space-y-4 animate-slide-up">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 text-cinema-500 hover:text-cinema-700"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Star className="w-8 h-8 text-primary fill-primary" />
            </div>
          </div>

          {/* Text */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-cinema-800">{title}</h3>
            {subtitle && (
              <p className="text-cinema-500 mt-1">{subtitle}</p>
            )}
          </div>

          {/* Share prompt */}
          <div className="bg-primary/10 rounded-2xl p-4 text-center">
            <p className="text-sm text-cinema-700 mb-3">
              Share this moment and earn bonus stars!
            </p>
            <div className="flex items-center justify-center gap-2 text-primary font-bold">
              <Sparkles className="w-4 h-4" />
              <span>+0.5 Stars</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 py-3 rounded-xl border border-cinema-200 text-cinema-600 font-semibold hover:bg-cinema-100 transition"
            >
              Maybe Later
            </button>
            <button
              onClick={() => setShowCamera(true)}
              className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition"
            >
              <Camera className="w-5 h-5" />
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Camera modal */}
      {showCamera && (
        <ShareMoment
          showName={showName}
          venueName={venueName}
          onClose={() => setShowCamera(false)}
          onShareComplete={handleShareComplete}
        />
      )}
    </>
  );
}
