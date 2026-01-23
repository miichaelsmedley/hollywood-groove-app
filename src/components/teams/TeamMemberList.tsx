/**
 * TeamMemberList Component
 *
 * Displays a list of team members with their roles and actions.
 */

import { Crown, User, UserMinus, ArrowRightLeft } from 'lucide-react';
import type { TeamMember } from '../../types/firebaseContract';

interface TeamMemberListProps {
  members: Array<TeamMember & { uid: string }>;
  currentUserId?: string;
  isOwner?: boolean;
  onRemoveMember?: (uid: string, displayName: string) => void;
  onTransferOwnership?: (uid: string, displayName: string) => void;
  className?: string;
}

export default function TeamMemberList({
  members,
  currentUserId,
  isOwner = false,
  onRemoveMember,
  onTransferOwnership,
  className = '',
}: TeamMemberListProps) {
  if (members.length === 0) {
    return (
      <div className={`text-center py-8 text-cinema-500 ${className}`}>
        No team members yet
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {members.map((member) => (
        <div
          key={member.uid}
          className={`flex items-center gap-3 p-3 rounded-xl border transition ${
            member.uid === currentUserId
              ? 'bg-primary/10 border-primary/30'
              : 'bg-cinema-50/10 border-cinema-200'
          }`}
        >
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-cinema-50/20 flex items-center justify-center overflow-hidden">
            {member.photo_url ? (
              <img
                src={member.photo_url}
                alt={member.display_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-5 h-5 text-cinema-400" />
            )}
          </div>

          {/* Name and role */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-medium truncate ${
                  member.uid === currentUserId ? 'text-primary' : 'text-cinema-100'
                }`}
              >
                {member.display_name}
              </span>
              {member.uid === currentUserId && (
                <span className="text-xs text-cinema-500">(you)</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-cinema-500">
              {member.role === 'owner' ? (
                <>
                  <Crown className="w-3 h-3 text-primary" />
                  <span className="text-primary">Owner</span>
                </>
              ) : (
                <span>Member</span>
              )}
              <span className="mx-1">·</span>
              <span>Joined {formatJoinDate(member.joined_at)}</span>
            </div>
          </div>

          {/* Owner actions */}
          {isOwner && member.uid !== currentUserId && member.role !== 'owner' && (
            <div className="flex items-center gap-1">
              {onTransferOwnership && (
                <button
                  onClick={() => onTransferOwnership(member.uid, member.display_name)}
                  className="p-2 rounded-lg text-cinema-400 hover:text-primary hover:bg-primary/10 transition"
                  title="Transfer ownership"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
              )}
              {onRemoveMember && (
                <button
                  onClick={() => onRemoveMember(member.uid, member.display_name)}
                  className="p-2 rounded-lg text-cinema-400 hover:text-red-400 hover:bg-red-400/10 transition"
                  title="Remove member"
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function formatJoinDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });
}
