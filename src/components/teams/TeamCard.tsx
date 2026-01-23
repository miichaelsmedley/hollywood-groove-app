/**
 * TeamCard Component
 *
 * Displays team information in a card format.
 */

import { Link } from 'react-router-dom';
import { Users, Crown, ChevronRight, Settings } from 'lucide-react';
import type { Team, MemberTeamInfo } from '../../types/firebaseContract';
import { TeamQRCodeCompact } from './TeamQRCode';

interface TeamCardProps {
  team: Team;
  teamId: string;
  memberInfo?: MemberTeamInfo;
  showQR?: boolean;
  showActions?: boolean;
  className?: string;
}

export default function TeamCard({
  team,
  teamId,
  memberInfo,
  showQR = false,
  showActions = true,
  className = '',
}: TeamCardProps) {
  const isOwner = memberInfo?.role === 'owner';

  return (
    <div className={`rounded-xl bg-cinema-50/10 border border-cinema-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-cinema-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-cinema-100 truncate">
                {team.name}
              </h3>
              {isOwner && (
                <Crown className="w-4 h-4 text-primary flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-cinema-500">
              <Users className="w-4 h-4" />
              <span>
                {team.member_count} / {team.settings.max_members} members
              </span>
            </div>
          </div>

          {showQR && (
            <TeamQRCodeCompact teamCode={team.code} size={60} />
          )}
        </div>
      </div>

      {/* Code display */}
      <div className="px-4 py-3 bg-cinema-50/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-cinema-500">Join Code</p>
            <p className="text-lg font-mono font-bold tracking-wider text-primary">
              {team.code}
            </p>
          </div>
          {isOwner && (
            <div className="text-xs text-cinema-500">
              Top {team.settings.top_contributors} scores count
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="p-3 border-t border-cinema-200">
          <div className="flex gap-2">
            <Link
              to={`/teams/${teamId}`}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-cinema font-semibold hover:bg-primary/90 transition"
            >
              <span>View Team</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
            {isOwner && (
              <Link
                to={`/teams/${teamId}?settings=true`}
                className="flex items-center justify-center p-2 rounded-lg bg-cinema-50/20 border border-cinema-200 text-cinema-400 hover:text-cinema-100 hover:border-cinema-100 transition"
              >
                <Settings className="w-5 h-5" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact team card for preview (e.g., when joining)
 */
export function TeamCardPreview({
  team,
  className = '',
}: {
  team: Team;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-cinema-50/10 border border-cinema-200 p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-cinema-100 truncate">
            {team.name}
          </h3>
          <div className="flex items-center gap-3 text-sm text-cinema-500">
            <span>{team.member_count} members</span>
            <span>·</span>
            <span>Max {team.settings.max_members}</span>
          </div>
        </div>
      </div>

      {team.member_count >= team.settings.max_members && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm text-center">
          This team is full
        </div>
      )}
    </div>
  );
}
