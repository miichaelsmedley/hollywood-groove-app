import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Scanner } from "@yudiel/react-qr-scanner";
import { ArrowLeft, Camera, FlaskConical, UserPlus, X } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { useUserTeam } from "../../hooks/useUserTeam";
import { TeamCardPreview } from "../../components/teams/TeamCard";
import {
  getTeamByCode,
  joinTeam,
} from "../../lib/teamService";
import { getTestAwareUrl, useIsTestMode } from "../../lib/testMode";
import type { Team } from "../../types/firebaseContract";

export function JoinTeam() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isTestMode = useIsTestMode();
  const { userProfile } = useUser();
  const { isInTeam, loading: teamLoading } = useUserTeam({ isTestMode });

  const [code, setCode] = useState(searchParams.get('code') || '');
  const [previewTeam, setPreviewTeam] = useState<{ teamId: string; team: Team } | null>(null);
  const [searching, setSearching] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // Redirect if already in a team
  useEffect(() => {
    if (!teamLoading && isInTeam) {
      navigate(getTestAwareUrl('/teams', isTestMode));
    }
  }, [teamLoading, isInTeam, navigate, isTestMode]);

  // Auto-search if code from URL
  useEffect(() => {
    if (searchParams.get('code') && !previewTeam) {
      handleSearch();
    }
  }, []);

  const handleSearch = async () => {
    if (!code.trim()) {
      setError('Please enter a team code');
      return;
    }

    setSearching(true);
    setError(null);
    setPreviewTeam(null);

    const result = await getTeamByCode(code.trim(), isTestMode);

    setSearching(false);

    if (result) {
      setPreviewTeam(result);
    } else {
      setError('Team not found. Check the code and try again.');
    }
  };

  const handleJoin = async () => {
    if (!userProfile?.uid || !userProfile?.displayName) {
      setError('Please sign in to join a team');
      return;
    }

    if (!previewTeam) {
      setError('Please search for a team first');
      return;
    }

    setJoining(true);
    setError(null);

    const result = await joinTeam(
      userProfile.uid,
      userProfile.displayName,
      code.trim(),
      userProfile.photoURL,
      isTestMode
    );

    setJoining(false);

    if (result.success && result.teamId) {
      navigate(getTestAwareUrl(`/teams/${result.teamId}`, isTestMode));
    } else {
      setError(result.error || 'Failed to join team');
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      {isTestMode && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm">
          <FlaskConical className="w-4 h-4" />
          <span>Test Mode - Searching test teams only</span>
        </div>
      )}

      <Link
        to={getTestAwareUrl('/teams', isTestMode)}
        className="inline-flex items-center gap-2 text-cinema-400 hover:text-cinema-200 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Teams</span>
      </Link>

      <section className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
          <UserPlus className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-cinema-100">Join a Team</h1>
        <p className="text-cinema-400">Enter a team code to join</p>
      </section>

      <section className="space-y-4">
        {/* QR Scanner */}
        {showScanner && (
          <div className="relative rounded-xl overflow-hidden border border-cinema-200">
            <button
              onClick={() => setShowScanner(false)}
              className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <Scanner
              onScan={(result) => {
                if (result && result[0]?.rawValue) {
                  const scannedUrl = result[0].rawValue;
                  // Extract code from URL like /teams/join?code=ABC123
                  const codeMatch = scannedUrl.match(/[?&]code=([A-Z0-9]{6})/i);
                  if (codeMatch) {
                    setCode(codeMatch[1].toUpperCase());
                    setShowScanner(false);
                    // Auto-search after scanning
                    setTimeout(() => {
                      const searchBtn = document.querySelector('[data-search-btn]') as HTMLButtonElement;
                      searchBtn?.click();
                    }, 100);
                  } else {
                    // Maybe the QR code is just the code itself
                    const plainCode = scannedUrl.match(/^[A-Z0-9]{6}$/i);
                    if (plainCode) {
                      setCode(plainCode[0].toUpperCase());
                      setShowScanner(false);
                      setTimeout(() => {
                        const searchBtn = document.querySelector('[data-search-btn]') as HTMLButtonElement;
                        searchBtn?.click();
                      }, 100);
                    }
                  }
                }
              }}
              styles={{
                container: { height: '250px' },
                video: { objectFit: 'cover' },
              }}
            />
            <p className="text-center text-cinema-400 text-sm py-2 bg-cinema-900/80">
              Point camera at team QR code
            </p>
          </div>
        )}

        {/* Code Input */}
        <div>
          <label className="block text-sm font-medium text-cinema-300 mb-2">
            Team Code
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setPreviewTeam(null);
                setError(null);
              }}
              placeholder="e.g., HG4X9K"
              maxLength={6}
              className="flex-1 px-4 py-3 rounded-xl bg-cinema-50/10 border border-cinema-200 text-cinema-800 placeholder-cinema-500 focus:border-primary focus:outline-none transition font-mono text-lg tracking-wider text-center uppercase"
            />
            <button
              onClick={() => setShowScanner(true)}
              className="px-3 py-3 rounded-xl bg-cinema-50/20 border border-cinema-200 text-cinema-300 hover:border-primary hover:text-primary transition"
              title="Scan QR Code"
            >
              <Camera className="w-5 h-5" />
            </button>
            <button
              onClick={handleSearch}
              disabled={searching || !code.trim()}
              data-search-btn
              className="px-4 py-3 rounded-xl bg-cinema-50/20 border border-cinema-200 text-cinema-300 hover:border-primary hover:text-primary transition disabled:opacity-50"
            >
              {searching ? '...' : 'Find'}
            </button>
          </div>
        </div>

        {/* Team Preview */}
        {previewTeam && (
          <div className="space-y-4">
            <TeamCardPreview team={previewTeam.team} />

            {previewTeam.team.member_count < previewTeam.team.settings.max_members && (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full rounded-xl bg-primary px-4 py-3 text-cinema font-bold shadow-glow-lg active:scale-[0.99] transition disabled:opacity-50"
              >
                {joining ? 'Joining...' : 'Join Team'}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}
      </section>
    </div>
  );
}

export default JoinTeam;
