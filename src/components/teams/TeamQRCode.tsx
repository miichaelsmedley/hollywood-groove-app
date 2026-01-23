/**
 * TeamQRCode Component
 *
 * Displays a QR code for joining a team, along with the text code.
 */

import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface TeamQRCodeProps {
  teamCode: string;
  teamName: string;
  size?: number;
  showCode?: boolean;
  className?: string;
}

export default function TeamQRCode({
  teamCode,
  teamName,
  size = 200,
  showCode = true,
  className = '',
}: TeamQRCodeProps) {
  const [copied, setCopied] = useState(false);

  // Generate the join URL
  const joinUrl = `${window.location.origin}/teams/join?code=${teamCode}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(teamCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* QR Code */}
      <div className="p-4 bg-white rounded-2xl shadow-lg">
        <QRCodeSVG
          value={joinUrl}
          size={size}
          level="M"
          includeMargin={false}
          bgColor="#FFFFFF"
          fgColor="#0B0B0D"
        />
      </div>

      {/* Team Name */}
      <div className="mt-4 text-center">
        <p className="text-sm text-cinema-400">Scan to join</p>
        <p className="text-lg font-bold text-cinema-100">{teamName}</p>
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
}: {
  teamCode: string;
  size?: number;
}) {
  const joinUrl = `${window.location.origin}/teams/join?code=${teamCode}`;

  return (
    <div className="p-2 bg-white rounded-lg">
      <QRCodeSVG
        value={joinUrl}
        size={size}
        level="M"
        includeMargin={false}
        bgColor="#FFFFFF"
        fgColor="#0B0B0D"
      />
    </div>
  );
}
