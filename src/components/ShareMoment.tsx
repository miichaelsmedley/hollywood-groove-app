/**
 * ShareMoment Component
 *
 * Camera overlay for capturing and sharing show moments.
 * Photos are shared directly to social platforms (not stored by us).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera, X, Share2, RotateCcw, Sparkles, Instagram, Download,
  CheckCircle, Star
} from 'lucide-react';

interface ShareMomentProps {
  showName?: string;
  venueName?: string;
  onClose: () => void;
  onShareComplete?: () => void;
}

// TikTok icon (not in lucide)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  );
}

type CameraMode = 'setup' | 'camera' | 'preview' | 'shared';

export default function ShareMoment({
  showName = 'Hollywood Groove',
  venueName,
  onClose,
  onShareComplete,
}: ShareMomentProps) {
  const [mode, setMode] = useState<CameraMode>('setup');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [error, setError] = useState<string | null>(null);
  const [starsEarned, setStarsEarned] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const today = new Date().toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setMode('camera');
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera. Please allow camera permissions.');
    }
  }, [facingMode]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Flip camera
  const flipCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  // Re-start camera when facing mode changes
  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    }
  }, [facingMode]);

  // Capture photo with overlay
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame (mirror for selfie cam)
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Draw branded overlay
    const padding = canvas.width * 0.05;
    const fontSize = canvas.width * 0.04;

    // Semi-transparent gradient at bottom
    const gradient = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3);

    // Hollywood Groove branding
    ctx.fillStyle = '#F59E0B'; // Primary gold
    ctx.font = `bold ${fontSize * 1.5}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('Hollywood Groove', padding, canvas.height - padding * 2.5);

    // Show/venue info
    ctx.fillStyle = '#ffffff';
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    const infoText = venueName ? `${showName} @ ${venueName}` : showName;
    ctx.fillText(infoText, padding, canvas.height - padding * 1.5);

    // Date
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${fontSize * 0.8}px system-ui, sans-serif`;
    ctx.fillText(today, padding, canvas.height - padding * 0.5);

    // Hashtag on right
    ctx.fillStyle = '#F59E0B';
    ctx.textAlign = 'right';
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillText('#HollywoodGroove', canvas.width - padding, canvas.height - padding);

    // Convert to image
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    setMode('preview');
    stopCamera();
  }, [facingMode, showName, venueName, today, stopCamera]);

  // Retake photo
  const retake = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  // Share using Web Share API
  const shareImage = useCallback(async () => {
    if (!capturedImage) return;

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], 'hollywood-groove-moment.jpg', { type: 'image/jpeg' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Hollywood Groove Moment',
          text: `Having a blast at ${showName}! 🎬✨ #HollywoodGroove`,
        });

        // User completed share
        setStarsEarned(true);
        setMode('shared');
        onShareComplete?.();
      } else {
        // Fallback: download the image
        const link = document.createElement('a');
        link.href = capturedImage;
        link.download = 'hollywood-groove-moment.jpg';
        link.click();

        setStarsEarned(true);
        setMode('shared');
        onShareComplete?.();
      }
    } catch (err) {
      console.error('Share error:', err);
      // User cancelled - that's okay
      if ((err as Error).name !== 'AbortError') {
        setError('Could not share. Try downloading instead.');
      }
    }
  }, [capturedImage, showName, onShareComplete]);

  // Download image
  const downloadImage = useCallback(() => {
    if (!capturedImage) return;

    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = 'hollywood-groove-moment.jpg';
    link.click();
  }, [capturedImage]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Close button */}
      <button
        onClick={() => {
          stopCamera();
          onClose();
        }}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Setup mode - instructions */}
      {mode === 'setup' && (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
            <Camera className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Share Your Moment</h2>
          <p className="text-cinema-500 mb-8 max-w-xs">
            Capture a photo with our branded overlay and share it to earn stars!
          </p>

          <button
            onClick={startCamera}
            className="px-8 py-4 bg-primary text-white rounded-2xl font-bold text-lg hover:bg-primary/90 transition flex items-center gap-3"
          >
            <Camera className="w-5 h-5" />
            Open Camera
          </button>

          <div className="mt-8 flex items-center gap-2 text-cinema-500 text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Earn <strong className="text-primary">0.5 stars</strong> for sharing!</span>
          </div>

          {error && (
            <p className="mt-4 text-red-400 text-sm">{error}</p>
          )}
        </div>
      )}

      {/* Camera mode */}
      {mode === 'camera' && (
        <div className="relative h-full">
          {/* Video feed */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />

          {/* Live overlay preview */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
            <div className="text-primary font-bold text-xl">Hollywood Groove</div>
            <div className="text-white text-sm">
              {venueName ? `${showName} @ ${venueName}` : showName}
            </div>
            <div className="text-white/70 text-xs">{today}</div>
            <div className="text-primary font-bold text-sm absolute bottom-4 right-4">
              #HollywoodGroove
            </div>
          </div>

          {/* Camera controls */}
          <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-8">
            {/* Flip camera */}
            <button
              onClick={flipCamera}
              className="p-4 rounded-full bg-white/20 text-white hover:bg-white/30 transition"
            >
              <RotateCcw className="w-6 h-6" />
            </button>

            {/* Capture button */}
            <button
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full bg-white border-4 border-primary flex items-center justify-center hover:scale-105 transition-transform"
            >
              <div className="w-16 h-16 rounded-full bg-primary" />
            </button>

            {/* Placeholder for symmetry */}
            <div className="w-14" />
          </div>
        </div>
      )}

      {/* Preview mode */}
      {mode === 'preview' && capturedImage && (
        <div className="relative h-full flex flex-col">
          {/* Preview image */}
          <div className="flex-1 flex items-center justify-center bg-black">
            <img
              src={capturedImage}
              alt="Captured moment"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* Actions */}
          <div className="p-6 bg-cinema-50 space-y-4">
            <div className="flex items-center justify-center gap-2 text-cinema-500 text-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Share to earn <strong className="text-primary">0.5 stars</strong>!</span>
            </div>

            {/* Share buttons */}
            <div className="flex gap-3">
              <button
                onClick={shareImage}
                className="flex-1 py-4 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition"
              >
                <Share2 className="w-5 h-5" />
                Share
              </button>

              <button
                onClick={downloadImage}
                className="px-4 py-4 bg-cinema-100 text-cinema-800 rounded-xl font-bold hover:bg-cinema-200 transition"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>

            {/* Quick share to specific platforms */}
            <div className="flex items-center justify-center gap-4">
              <span className="text-xs text-cinema-500">Share to:</span>
              <button
                onClick={shareImage}
                className="p-2 rounded-lg bg-pink-500/20 text-pink-500 hover:bg-pink-500/30 transition"
                title="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </button>
              <button
                onClick={shareImage}
                className="p-2 rounded-lg bg-cinema-200 text-cinema-800 hover:bg-cinema-300 transition"
                title="TikTok"
              >
                <TikTokIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Retake button */}
            <button
              onClick={retake}
              className="w-full py-3 text-cinema-500 font-medium hover:text-cinema-700 transition"
            >
              Retake Photo
            </button>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}
          </div>
        </div>
      )}

      {/* Shared confirmation */}
      {mode === 'shared' && (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full bg-accent-green/20 flex items-center justify-center animate-pulse">
              <CheckCircle className="w-12 h-12 text-accent-green" />
            </div>
            {starsEarned && (
              <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-primary flex items-center justify-center animate-bounce">
                <Star className="w-5 h-5 text-white fill-white" />
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Thanks for Sharing!</h2>
          <p className="text-cinema-500 mb-4">
            Your Hollywood Groove moment is on its way!
          </p>

          {starsEarned && (
            <div className="px-4 py-2 bg-primary/20 rounded-full text-primary font-bold mb-8">
              +0.5 Stars Earned!
            </div>
          )}

          <button
            onClick={onClose}
            className="px-8 py-4 bg-cinema-100 text-cinema-800 rounded-2xl font-bold hover:bg-cinema-200 transition"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
