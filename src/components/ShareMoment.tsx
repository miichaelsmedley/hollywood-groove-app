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
  CheckCircle, Star, Loader2, Facebook
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

// X (Twitter) icon
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

// Threads icon
function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.023.85-.704 2.043-1.135 3.553-1.282.898-.088 1.814-.078 2.734.032l.007-.017c-.006-.904-.157-1.614-.449-2.11-.353-.6-.947-.898-1.767-.898h-.034c-.659.007-1.195.183-1.596.523-.39.333-.66.802-.807 1.395l-1.992-.466c.217-.872.654-1.622 1.302-2.228.82-.766 1.865-1.155 3.107-1.155h.043c1.467.016 2.588.542 3.335 1.562.67.917.996 2.142 1.002 3.75.35.157.687.33 1.01.523 1.137.682 1.98 1.574 2.507 2.653.728 1.49.842 3.883-.849 5.54-1.793 1.756-4.016 2.548-7.205 2.572zm-1.248-6.63c-.72.038-1.263.222-1.617.547-.326.299-.48.653-.459 1.052.044.788.717 1.496 2.05 1.496.048 0 .097-.001.146-.003 1.433-.077 2.303-1.072 2.586-2.955-.879-.152-1.792-.197-2.706-.137z"/>
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
  const [zoomLevel, setZoomLevel] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastPinchDistance = useRef<number | null>(null);

  const today = new Date().toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Pinch-to-zoom handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastPinchDistance.current = distance;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistance.current !== null) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = distance / lastPinchDistance.current;
      lastPinchDistance.current = distance;

      setZoomLevel(prev => {
        const newZoom = prev * delta;
        return Math.min(Math.max(newZoom, 1), 5); // Clamp between 1x and 5x
      });
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastPinchDistance.current = null;
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // Start camera with proper constraints for mobile
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setMode('loading');
      setCameraReady(false);

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Minimal constraints - let camera use native resolution to avoid digital zoom
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
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
          const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

          const onLoadedMetadata = () => {
            clearTimeout(timeout);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            resolve();
          };

          const onError = () => {
            clearTimeout(timeout);
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
      setZoomLevel(1); // Reset zoom when switching cameras

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newMode,
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
  // Simulates objectFit: 'cover' + zoom to capture exactly what user sees in preview
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get actual video dimensions from the stream
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Determine target dimensions based on screen orientation
    const screenIsPortrait = window.innerHeight > window.innerWidth;
    const targetWidth = screenIsPortrait ? 1080 : 1920;
    const targetHeight = screenIsPortrait ? 1920 : 1080;

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Calculate source crop to simulate objectFit: 'cover'
    // This captures exactly what the user sees in the preview
    const targetAspect = targetWidth / targetHeight;
    const videoAspect = videoWidth / videoHeight;

    let sourceX: number, sourceY: number, sourceWidth: number, sourceHeight: number;

    if (videoAspect > targetAspect) {
      // Video is wider than target - crop left and right
      sourceHeight = videoHeight;
      sourceWidth = videoHeight * targetAspect;
      sourceX = (videoWidth - sourceWidth) / 2;
      sourceY = 0;
    } else {
      // Video is taller than target - crop top and bottom
      sourceWidth = videoWidth;
      sourceHeight = videoWidth / targetAspect;
      sourceX = 0;
      sourceY = (videoHeight - sourceHeight) / 2;
    }

    // Apply zoom by shrinking the source rectangle (zoom into center)
    if (zoomLevel > 1) {
      const zoomedWidth = sourceWidth / zoomLevel;
      const zoomedHeight = sourceHeight / zoomLevel;
      sourceX = sourceX + (sourceWidth - zoomedWidth) / 2;
      sourceY = sourceY + (sourceHeight - zoomedHeight) / 2;
      sourceWidth = zoomedWidth;
      sourceHeight = zoomedHeight;
    }

    // Mirror for front camera to match the preview
    if (facingMode === 'user') {
      ctx.translate(targetWidth, 0);
      ctx.scale(-1, 1);
    }

    // Draw the cropped portion of video to fill canvas (simulates cover + zoom)
    ctx.drawImage(
      video,
      sourceX, sourceY, sourceWidth, sourceHeight,  // Source rectangle (crop)
      0, 0, targetWidth, targetHeight                // Destination (full canvas)
    );
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Draw branded overlay
    const padding = canvas.width * 0.05;
    const fontSize = Math.min(canvas.width, canvas.height) * 0.04;

    // Semi-transparent gradient at bottom
    const gradient = ctx.createLinearGradient(0, canvas.height * 0.75, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, canvas.height * 0.75, canvas.width, canvas.height * 0.25);

    // Hollywood Groove branding
    ctx.fillStyle = '#F59E0B';
    ctx.font = `bold ${fontSize * 1.5}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('Hollywood Groove', padding, canvas.height - padding * 3);

    // Show/venue info
    ctx.fillStyle = '#ffffff';
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    const infoText = venueName ? `${showName} @ ${venueName}` : showName;
    ctx.fillText(infoText, padding, canvas.height - padding * 2);

    // Date
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${fontSize * 0.8}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText(today, padding, canvas.height - padding * 1.2);

    // Hashtag on right
    ctx.fillStyle = '#F59E0B';
    ctx.textAlign = 'right';
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText('#HollywoodGroove', canvas.width - padding, canvas.height - padding * 1.2);

    // Convert to image
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    setMode('preview');
    stopCamera();
  }, [facingMode, showName, venueName, today, stopCamera, zoomLevel]);

  // Retake photo
  const retake = useCallback(() => {
    setCapturedImage(null);
    setZoomLevel(1); // Reset zoom
    startCamera();
  }, [startCamera]);

  // Share using Web Share API (best for images)
  const shareWithNativeSheet = useCallback(async () => {
    if (!capturedImage) return;

    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], 'hollywood-groove-moment.jpg', { type: 'image/jpeg' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Hollywood Groove Moment',
          text: `Having a blast at ${showName}! 🎬✨ #HollywoodGroove`,
        });
        setStarsEarned(true);
        setMode('shared');
        onShareComplete?.();
      } else {
        // Fallback: download
        downloadImage();
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Could not share. Try downloading instead.');
      }
    }
  }, [capturedImage, showName, onShareComplete]);

  // Share to specific platform with pre-filled text
  const shareToFacebook = useCallback(() => {
    const text = encodeURIComponent(`Having a blast at ${showName}! 🎬✨ #HollywoodGroove`);
    const url = encodeURIComponent('https://hollywoodgroove.com');
    // Try native app first, fallback to web
    window.location.href = `fb://share?quote=${text}`;
    setTimeout(() => {
      window.open(`https://www.facebook.com/sharer/sharer.php?quote=${text}&u=${url}`, '_blank');
    }, 500);
    // Still show success since they initiated share
    setStarsEarned(true);
    setMode('shared');
    onShareComplete?.();
  }, [showName, onShareComplete]);

  const shareToTwitter = useCallback(() => {
    const text = encodeURIComponent(`Having a blast at ${showName}! 🎬✨`);
    const hashtags = 'HollywoodGroove';
    const url = encodeURIComponent('https://hollywoodgroove.com');
    // Twitter/X web intent works well and opens app if installed
    window.open(`https://twitter.com/intent/tweet?text=${text}&hashtags=${hashtags}&url=${url}`, '_blank');
    setStarsEarned(true);
    setMode('shared');
    onShareComplete?.();
  }, [showName, onShareComplete]);

  const shareToInstagram = useCallback(async () => {
    // Instagram doesn't have a share URL, but we can:
    // 1. Use native share sheet (best for images)
    // 2. Or just download and open Instagram
    if (capturedImage) {
      try {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        const file = new File([blob], 'hollywood-groove-moment.jpg', { type: 'image/jpeg' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Share to Instagram',
          });
          setStarsEarned(true);
          setMode('shared');
          onShareComplete?.();
          return;
        }
      } catch (e) {
        // Fall through to download
      }
    }
    // Fallback: download image, then try to open Instagram
    downloadImage();
    window.location.href = 'instagram://';
    setStarsEarned(true);
    setMode('shared');
    onShareComplete?.();
  }, [capturedImage, onShareComplete]);

  const shareToThreads = useCallback(() => {
    const text = encodeURIComponent(`Having a blast at ${showName}! 🎬✨ #HollywoodGroove`);
    // Threads has a web intent
    window.open(`https://www.threads.net/intent/post?text=${text}`, '_blank');
    setStarsEarned(true);
    setMode('shared');
    onShareComplete?.();
  }, [showName, onShareComplete]);

  const shareToTikTok = useCallback(async () => {
    // TikTok doesn't have direct share, use native sheet or download
    if (capturedImage) {
      try {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        const file = new File([blob], 'hollywood-groove-moment.jpg', { type: 'image/jpeg' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
          setStarsEarned(true);
          setMode('shared');
          onShareComplete?.();
          return;
        }
      } catch (e) {
        // Fall through
      }
    }
    downloadImage();
    window.location.href = 'tiktok://';
    setStarsEarned(true);
    setMode('shared');
    onShareComplete?.();
  }, [capturedImage, onShareComplete]);

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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        zIndex: 99999,
        overflow: 'hidden',
      }}
    >
      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Video element - always mounted for smooth transitions */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          opacity: mode === 'camera' ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            minWidth: '100%',
            minHeight: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'cover',
            transform: `translate(-50%, -50%) ${facingMode === 'user' ? 'scaleX(-1)' : ''} scale(${zoomLevel})`,
          }}
        />
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 100001,
          padding: '12px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0,0,0,0.6)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <X style={{ width: '24px', height: '24px', color: 'white' }} />
      </button>

      {/* Setup mode */}
      {mode === 'setup' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'rgba(245,158,11,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
          }}>
            <Camera style={{ width: '40px', height: '40px', color: '#F59E0B' }} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
            Share Your Moment
          </h2>
          <p style={{ color: '#9CA3AF', marginBottom: '8px', maxWidth: '280px' }}>
            Take a selfie with our branded frame!
          </p>
          <p style={{ color: '#6B7280', marginBottom: '32px', maxWidth: '280px', fontSize: '14px' }}>
            The Hollywood Groove branding will appear at the bottom of your photo.
          </p>

          <button
            onClick={startCamera}
            style={{
              padding: '16px 32px',
              backgroundColor: '#F59E0B',
              color: 'black',
              borderRadius: '16px',
              fontWeight: 'bold',
              fontSize: '18px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <Camera style={{ width: '20px', height: '20px' }} />
            Take Photo
          </button>

          <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '8px', color: '#9CA3AF', fontSize: '14px' }}>
            <Sparkles style={{ width: '16px', height: '16px', color: '#F59E0B' }} />
            <span>Earn <strong style={{ color: '#F59E0B' }}>0.5 stars</strong> for sharing!</span>
          </div>

          {error && (
            <p style={{ marginTop: '16px', color: '#F87171', fontSize: '14px' }}>{error}</p>
          )}
        </div>
      )}

      {/* Loading mode */}
      {mode === 'loading' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Loader2 style={{ width: '48px', height: '48px', color: '#F59E0B', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'white', marginTop: '16px' }}>Opening camera...</p>
        </div>
      )}

      {/* Camera mode overlays */}
      {mode === 'camera' && cameraReady && (
        <>
          {/* Live overlay preview */}
          <div style={{
            position: 'absolute',
            bottom: '140px',
            left: 0,
            right: 0,
            padding: '16px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
            pointerEvents: 'none',
            zIndex: 100000,
          }}>
            <div style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: '20px' }}>Hollywood Groove</div>
            <div style={{ color: 'white', fontSize: '14px' }}>
              {venueName ? `${showName} @ ${venueName}` : showName}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{today}</div>
            <div style={{ position: 'absolute', bottom: '16px', right: '16px', color: '#F59E0B', fontWeight: 'bold', fontSize: '14px' }}>
              #HollywoodGroove
            </div>
          </div>

          {/* Camera controls - positioned safely above home indicator */}
          <div style={{
            position: 'absolute',
            bottom: '40px',
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '32px',
            zIndex: 100000,
            paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          }}>
            {/* Flip camera */}
            <button
              onClick={flipCamera}
              style={{
                padding: '16px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <RotateCcw style={{ width: '24px', height: '24px', color: 'white' }} />
            </button>

            {/* Capture button */}
            <button
              onClick={capturePhoto}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: 'white',
                border: '4px solid #F59E0B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#F59E0B',
              }} />
            </button>

            {/* Placeholder for symmetry */}
            <div style={{ width: '56px', height: '56px' }} />
          </div>

          {/* Hint text and zoom indicator */}
          <div style={{
            position: 'absolute',
            top: '80px',
            left: 0,
            right: 0,
            textAlign: 'center',
            zIndex: 100000,
          }}>
            <p style={{
              display: 'inline-block',
              padding: '8px 16px',
              borderRadius: '20px',
              backgroundColor: 'rgba(0,0,0,0.4)',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '14px',
            }}>
              {zoomLevel > 1
                ? `${zoomLevel.toFixed(1)}x zoom · Pinch to adjust`
                : 'Pinch to zoom · Tap to capture'}
            </p>
          </div>
        </>
      )}

      {/* Preview mode */}
      {mode === 'preview' && capturedImage && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#000',
        }}>
          {/* Preview image */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '16px',
          }}>
            <img
              src={capturedImage}
              alt="Captured moment"
              style={{
                maxHeight: '100%',
                maxWidth: '100%',
                objectFit: 'contain',
                borderRadius: '12px',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{
            padding: '16px',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            backgroundColor: '#111',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#9CA3AF', fontSize: '14px', marginBottom: '12px' }}>
              <Sparkles style={{ width: '16px', height: '16px', color: '#F59E0B' }} />
              <span>Share to earn <strong style={{ color: '#F59E0B' }}>0.5 stars</strong>!</span>
            </div>

            {/* Main share button - uses native share sheet */}
            <button
              onClick={shareWithNativeSheet}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#F59E0B',
                color: 'black',
                borderRadius: '12px',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <Share2 style={{ width: '20px', height: '20px' }} />
              Share Photo
            </button>

            {/* Platform-specific share buttons */}
            <p style={{ textAlign: 'center', color: '#6B7280', fontSize: '12px', marginBottom: '8px' }}>
              Or share directly to:
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              marginBottom: '12px',
            }}>
              <button onClick={shareToInstagram} style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(236,72,153,0.2)', border: 'none', cursor: 'pointer' }}>
                <Instagram style={{ width: '24px', height: '24px', color: '#EC4899' }} />
              </button>
              <button onClick={shareToFacebook} style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(59,130,246,0.2)', border: 'none', cursor: 'pointer' }}>
                <Facebook style={{ width: '24px', height: '24px', color: '#3B82F6' }} />
              </button>
              <button onClick={shareToTwitter} style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer' }}>
                <XIcon className="w-6 h-6 text-white" />
              </button>
              <button onClick={shareToThreads} style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer' }}>
                <ThreadsIcon className="w-6 h-6 text-white" />
              </button>
              <button onClick={shareToTikTok} style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer' }}>
                <TikTokIcon className="w-6 h-6 text-white" />
              </button>
              <button onClick={downloadImage} style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer' }}>
                <Download style={{ width: '24px', height: '24px', color: 'white' }} />
              </button>
            </div>

            {/* Retake button */}
            <button
              onClick={retake}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                color: '#9CA3AF',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              Retake Photo
            </button>

            {error && (
              <p style={{ textAlign: 'center', color: '#F87171', fontSize: '14px', marginTop: '8px' }}>{error}</p>
            )}
          </div>
        </div>
      )}

      {/* Shared confirmation */}
      {mode === 'shared' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
        }}>
          <div style={{ position: 'relative', marginBottom: '24px' }}>
            <div style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              backgroundColor: 'rgba(34,197,94,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <CheckCircle style={{ width: '48px', height: '48px', color: '#22C55E' }} />
            </div>
            {starsEarned && (
              <div style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Star style={{ width: '20px', height: '20px', color: 'black', fill: 'black' }} />
              </div>
            )}
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
            Thanks for Sharing!
          </h2>
          <p style={{ color: '#9CA3AF', marginBottom: '16px' }}>
            Your Hollywood Groove moment is on its way!
          </p>

          {starsEarned && (
            <div style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(245,158,11,0.2)',
              borderRadius: '20px',
              color: '#F59E0B',
              fontWeight: 'bold',
              marginBottom: '32px',
            }}>
              +0.5 Stars Earned!
            </div>
          )}

          <button
            onClick={handleClose}
            style={{
              padding: '16px 32px',
              backgroundColor: '#374151',
              color: 'white',
              borderRadius: '16px',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Wrapper that uses portal to ensure proper rendering
export default function ShareMoment(props: ShareMomentProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <ShareMomentContent {...props} />,
    document.body
  );
}
