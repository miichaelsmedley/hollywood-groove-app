/**
 * ShareMoment Component
 *
 * Camera overlay for capturing and sharing show moments.
 * Photos are shared directly to social platforms (not stored by us).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera, X, Share2, RotateCcw, Sparkles, Instagram, Download,
  CheckCircle, Star, Loader2
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

type CameraMode = 'setup' | 'loading' | 'camera' | 'preview' | 'shared';

function ShareMomentContent({
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
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const today = new Date().toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setMode('loading');
      setCameraReady(false);

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;

          const onLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            resolve();
          };

          const onError = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            reject(new Error('Video failed to load'));
          };

          video.addEventListener('loadedmetadata', onLoadedMetadata);
          video.addEventListener('error', onError);
        });

        await videoRef.current.play();
        setCameraReady(true);
        setMode('camera');
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera. Please allow camera permissions and try again.');
      setMode('setup');
    }
  }, [facingMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Flip camera
  const flipCamera = useCallback(async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);

    // Restart camera with new facing mode
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      setMode('loading');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: newMode },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        setMode('camera');
      }
    } catch (err) {
      console.error('Flip camera error:', err);
      setError('Could not switch camera');
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

  // Handle close
  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  return (
    <div
      className="fixed inset-0 bg-black"
      style={{
        zIndex: 99999,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Video element - always mounted but hidden when not in camera mode */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        webkit-playsinline="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
          display: mode === 'camera' || mode === 'loading' ? 'block' : 'none',
        }}
      />

      {/* Close button - always visible */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
        style={{ zIndex: 100001 }}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Setup mode - instructions */}
      {mode === 'setup' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
            <Camera className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Share Your Moment</h2>
          <p className="text-gray-400 mb-2 max-w-xs">
            Take a selfie with our branded frame!
          </p>
          <p className="text-gray-500 mb-8 max-w-xs text-sm">
            The Hollywood Groove branding will appear at the bottom of your photo.
          </p>

          <button
            onClick={startCamera}
            className="px-8 py-4 bg-primary text-black rounded-2xl font-bold text-lg hover:bg-primary/90 transition flex items-center gap-3"
          >
            <Camera className="w-5 h-5" />
            Take Photo
          </button>

          <div className="mt-8 flex items-center gap-2 text-gray-400 text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Earn <strong className="text-primary">0.5 stars</strong> for sharing!</span>
          </div>

          {error && (
            <p className="mt-4 text-red-400 text-sm">{error}</p>
          )}
        </div>
      )}

      {/* Loading mode */}
      {mode === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-white">Opening camera...</p>
        </div>
      )}

      {/* Camera mode overlays */}
      {mode === 'camera' && cameraReady && (
        <>
          {/* Live overlay preview - shows what branding will look like */}
          <div
            className="absolute bottom-32 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent pointer-events-none"
            style={{ zIndex: 100000 }}
          >
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
          <div
            className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-8 pb-safe"
            style={{ zIndex: 100000 }}
          >
            {/* Flip camera */}
            <button
              onClick={flipCamera}
              className="p-4 rounded-full bg-white/20 text-white hover:bg-white/30 transition backdrop-blur-sm"
            >
              <RotateCcw className="w-6 h-6" />
            </button>

            {/* Capture button */}
            <button
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full bg-white border-4 border-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg"
            >
              <div className="w-16 h-16 rounded-full bg-primary" />
            </button>

            {/* Placeholder for symmetry */}
            <div className="w-14 h-14" />
          </div>

          {/* Hint text */}
          <div
            className="absolute top-20 left-0 right-0 text-center"
            style={{ zIndex: 100000 }}
          >
            <p className="text-white/80 text-sm bg-black/40 inline-block px-4 py-2 rounded-full backdrop-blur-sm">
              Tap the button to capture!
            </p>
          </div>
        </>
      )}

      {/* Preview mode */}
      {mode === 'preview' && capturedImage && (
        <div className="absolute inset-0 flex flex-col bg-black">
          {/* Preview image */}
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <img
              src={capturedImage}
              alt="Captured moment"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* Actions */}
          <div className="p-6 bg-gray-900 space-y-4 pb-safe">
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Share to earn <strong className="text-primary">0.5 stars</strong>!</span>
            </div>

            {/* Share buttons */}
            <div className="flex gap-3">
              <button
                onClick={shareImage}
                className="flex-1 py-4 bg-primary text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition"
              >
                <Share2 className="w-5 h-5" />
                Share
              </button>

              <button
                onClick={downloadImage}
                className="px-4 py-4 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>

            {/* Quick share to specific platforms */}
            <div className="flex items-center justify-center gap-4">
              <span className="text-xs text-gray-500">Share to:</span>
              <button
                onClick={shareImage}
                className="p-2 rounded-lg bg-pink-500/20 text-pink-500 hover:bg-pink-500/30 transition"
                title="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </button>
              <button
                onClick={shareImage}
                className="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition"
                title="TikTok"
              >
                <TikTokIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Retake button */}
            <button
              onClick={retake}
              className="w-full py-3 text-gray-400 font-medium hover:text-white transition"
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
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            {starsEarned && (
              <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-primary flex items-center justify-center animate-bounce">
                <Star className="w-5 h-5 text-black fill-black" />
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Thanks for Sharing!</h2>
          <p className="text-gray-400 mb-4">
            Your Hollywood Groove moment is on its way!
          </p>

          {starsEarned && (
            <div className="px-4 py-2 bg-primary/20 rounded-full text-primary font-bold mb-8">
              +0.5 Stars Earned!
            </div>
          )}

          <button
            onClick={handleClose}
            className="px-8 py-4 bg-gray-800 text-white rounded-2xl font-bold hover:bg-gray-700 transition"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// Wrapper that uses portal to ensure proper rendering
export default function ShareMoment(props: ShareMomentProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!mounted) return null;

  // Use portal to render at document root level
  return createPortal(
    <ShareMomentContent {...props} />,
    document.body
  );
}
