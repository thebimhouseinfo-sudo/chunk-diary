import { useState, useEffect, useCallback } from 'react';

export type MicStatus = 'idle' | 'prompt' | 'granted' | 'denied' | 'not_found';

export function useMicPermission() {
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');

  const checkPermissionAPI = useCallback(async (): Promise<string | null> => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicStatus(result.state as MicStatus);
        
        result.onchange = () => {
          setMicStatus(result.state as MicStatus);
        };
        return result.state;
      }
    } catch (e) {
      console.log('Permissions API not supported for microphone');
    }
    return null; // Permissions API unavailable (iOS Safari)
  }, []);

  /**
   * Request mic access via getUserMedia.
   * MUST be called from within a user gesture on iOS.
   * Returns true if granted, false if denied/not found.
   */
  const requestMic = useCallback(async (_isUserGesture = false): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // Release the stream immediately — we only needed to trigger the permission prompt
      stream.getTracks().forEach(track => track.stop());
      setMicStatus('granted');
      return true;
    } catch (err: any) {
      console.error('Error requesting mic permission:', err);
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        setMicStatus('denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMicStatus('not_found');
      } else {
        // On iOS, if called outside a gesture it may throw AbortError or similar
        // Keep as 'prompt' so the next user-gesture click can retry
        setMicStatus('prompt');
      }
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const status = await checkPermissionAPI();
      if (!mounted) return;

      if (status === 'granted') {
        // Already granted — nothing to do, state already set by checkPermissionAPI
        return;
      }

      if (status === 'denied') {
        // Already denied — state already set, show banner
        return;
      }

      if (status === 'prompt') {
        // Permissions API available and says "prompt":
        // On desktop/Android we can pre-request in background
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (!isIOS) {
          await requestMic(false);
        } else {
          // iOS: can't call getUserMedia outside user gesture — keep as 'prompt'
          // The first tap on the mic button will call requestMic(true) before starting recognition
          setMicStatus('prompt');
        }
        return;
      }

      if (status === null) {
        // Permissions API unavailable (iOS Safari, some older browsers)
        // We don't know the state yet — mark as 'prompt' so the first tap will request
        setMicStatus('prompt');
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [checkPermissionAPI, requestMic]);

  return { micStatus, requestMic };
}
