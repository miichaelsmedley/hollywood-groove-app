/**
 * TeamQRCode Component
 *
 * Displays a QR code for joining a team, along with the text code.
 * Supports test mode - when isTestMode is true, the QR code URL includes ?test=true
 */

import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, FlaskConical } from 'lucide-react';
import { useState } from 'react';

interface TeamQRCodeProps {
  teamCode: string;
  teamName: string;
  size?: number;
  showCode?: boolean;
  className?: string;
  isTestMode?: boolean;
}

export default function TeamQRCode({
  teamCode,
  teamName,
  size = 200,
  showCode = true,
  className = '',
  isTestMode = false,
}: TeamQRCodeProps) {
  const [copied, setCopied] = useState(false);

  // Generate the join URL (include test=true if in test mode)
  const joinUrl = isTestMode
    ? `${window.location.origin}/teams/join?code=${teamCode}&test=true`
    : `${window.location.origin}/teams/join?code=${teamCode}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(teamCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* QR Code */}
      <div className="p-4 bg-white rounded-2xl shadow-lg relative">
        <QRCodeSVG
          value={joinUrl}
          size={size}
          level="M"
          includeMargin={false}
          bgColor="#FFFFFF"
          fgColor="#0B0B0D"
        />
        {isTestMode && (
          <div className="absolute -top-2 -right-2 p-1 bg-amber-500 rounded-full">
            <FlaskConical className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Team Name */}
      <div className="mt-4 text-center">
        <p className="text-sm text-cinema-400">Scan to join</p>
        <p className="text-lg font-bold text-cinema-100">{teamName}</p>
        {isTestMode && (
          <p className="text-xs text-amber-400 mt-1">(Test Mode)</p>
        )}
      </div>

      {/* Join Code Display */}
      {showCode && (
        <div className="mt-4 w-full">
          <p className="text-xs text-cinema-500 text-center mb-2">Or enter code manually:</p>
          <button
            onClick={handleCopyCode}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-cinema-50/20 border border-cinema-200 rounded-xl hover:bg-cinema-50/30 transition group"
          >
            <span className="text-2xl font-mono font-bold tracking-widest text-primary">
              {teamCode}
            </span>
            {copied ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : (
              <Copy className="w-5 h-5 text-cinema-400 group-hover:text-cinema-200" />
            )}
          </button>
          <p className="text-xs text-cinema-500 text-center mt-2">
            {copied ? 'Copied!' : 'Tap to copy code'}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Compact QR code display for team cards
 */
export function TeamQRCodeCompact({
  teamCode,
  size = 80,
  isTestMode = false,
}: {
  teamCode: string;
  size?: number;
  isTestMode?: boolean;
}) {
  const joinUrl = isTestMode
    ? `${window.location.origin}/teams/join?code=${teamCode}&test=true`
    : `${window.location.origin}/teams/join?code=${teamCode}`;

  return (
    <div className="p-2 bg-white rounded-lg relative">
      <QRCodeSVG
        value={joinUrl}
        size={size}
        level="M"
        includeMargin={false}
        bgColor="#FFFFFF"
        fgColor="#0B0B0D"
      />
      {isTestMode && (
        <div className="absolute -top-1 -right-1 p-0.5 bg-amber-500 rounded-full">
          <FlaskConical className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  );
}
