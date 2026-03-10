/**
 * Browser Compatibility Check
 * Checks if the browser supports required features for the application
 */

export interface BrowserCapabilities {
  hasMediaDevices: boolean;
  hasGetUserMedia: boolean;
  hasMediaRecorder: boolean;
  hasWebSocket: boolean;
  hasAudioContext: boolean;
  hasWebAssembly: boolean;
  isSupported: boolean;
  unsupportedFeatures: string[];
}

export function checkBrowserCapabilities(): BrowserCapabilities {
  const unsupportedFeatures: string[] = [];

  // Check MediaDevices API
  const hasMediaDevices = !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices
  );
  if (!hasMediaDevices) {
    unsupportedFeatures.push('MediaDevices API');
  }

  // Check getUserMedia
  const hasGetUserMedia = !!(
    hasMediaDevices &&
    navigator.mediaDevices.getUserMedia
  );
  if (!hasGetUserMedia) {
    unsupportedFeatures.push('getUserMedia');
  }

  // Check MediaRecorder
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
  if (!hasMediaRecorder) {
    unsupportedFeatures.push('MediaRecorder');
  }

  // Check WebSocket
  const hasWebSocket = typeof WebSocket !== 'undefined';
  if (!hasWebSocket) {
    unsupportedFeatures.push('WebSocket');
  }

  // Check AudioContext (Web Audio API)
  const hasAudioContext = !!(
    typeof window !== 'undefined' &&
    (window.AudioContext || (window as any).webkitAudioContext)
  );
  if (!hasAudioContext) {
    unsupportedFeatures.push('Web Audio API');
  }

  // Check WebAssembly (optional but recommended)
  const hasWebAssembly = typeof WebAssembly !== 'undefined';
  if (!hasWebAssembly) {
    unsupportedFeatures.push('WebAssembly (optional)');
  }

  // All required features must be supported
  const isSupported = unsupportedFeatures.filter(f => !f.includes('optional')).length === 0;

  return {
    hasMediaDevices,
    hasGetUserMedia,
    hasMediaRecorder,
    hasWebSocket,
    hasAudioContext,
    hasWebAssembly,
    isSupported,
    unsupportedFeatures,
  };
}

export interface MicrophonePermissionStatus {
  state: 'granted' | 'denied' | 'prompt' | 'unknown';
  canRequest: boolean;
}

/**
 * Check microphone permission status
 * Note: Not all browsers support navigator.permissions API
 */
export async function checkMicrophonePermission(): Promise<MicrophonePermissionStatus> {
  try {
    // Check if Permissions API is supported
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      return {
        state: 'unknown',
        canRequest: true,
      };
    }

    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });

    return {
      state: result.state as 'granted' | 'denied' | 'prompt',
      canRequest: result.state === 'prompt',
    };
  } catch (error) {
    // Permissions API not supported or query failed
    console.warn('[BrowserCheck] Failed to check microphone permission:', error);
    return {
      state: 'unknown',
      canRequest: true,
    };
  }
}

export interface BrowserInfo {
  name: string;
  version: string;
  engine: string;
  os: string;
  isMobile: boolean;
}

/**
 * Detect browser information
 */
export function detectBrowser(): BrowserInfo {
  if (typeof navigator === 'undefined') {
    return {
      name: 'Unknown',
      version: 'Unknown',
      engine: 'Unknown',
      os: 'Unknown',
      isMobile: false,
    };
  }

  const ua = navigator.userAgent;
  const uaLower = ua.toLowerCase();

  // Detect OS
  let os = 'Unknown';
  if (uaLower.includes('win')) os = 'Windows';
  else if (uaLower.includes('mac')) os = 'macOS';
  else if (uaLower.includes('linux')) os = 'Linux';
  else if (uaLower.includes('android')) os = 'Android';
  else if (uaLower.includes('iphone') || uaLower.includes('ipad')) os = 'iOS';

  // Detect mobile
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(uaLower);

  // Detect browser
  let name = 'Unknown';
  let version = 'Unknown';
  let engine = 'Unknown';

  if (uaLower.includes('edg')) {
    name = 'Edge';
    version = ua.match(/edg\/([0-9.]+)/)?.[1] || 'Unknown';
    engine = 'Blink';
  } else if (uaLower.includes('chrome') && !uaLower.includes('edg')) {
    name = 'Chrome';
    version = ua.match(/chrome\/([0-9.]+)/)?.[1] || 'Unknown';
    engine = 'Blink';
  } else if (uaLower.includes('firefox')) {
    name = 'Firefox';
    version = ua.match(/firefox\/([0-9.]+)/)?.[1] || 'Unknown';
    engine = 'Gecko';
  } else if (uaLower.includes('safari') && !uaLower.includes('chrome')) {
    name = 'Safari';
    version = ua.match(/version\/([0-9.]+)/)?.[1] || 'Unknown';
    engine = 'WebKit';
  } else if (uaLower.includes('opera') || uaLower.includes('opr')) {
    name = 'Opera';
    version = ua.match(/(opera|opr)\/([0-9.]+)/)?.[2] || 'Unknown';
    engine = 'Blink';
  }

  return {
    name,
    version,
    engine,
    os,
    isMobile,
  };
}

/**
 * Get recommended browser message
 */
export function getRecommendedBrowserMessage(): string {
  const browser = detectBrowser();

  if (browser.os === 'iOS') {
    return 'For the best experience on iOS, please use Safari 14 or later.';
  }

  if (browser.os === 'Android') {
    return 'For the best experience on Android, please use Chrome 90 or later.';
  }

  return 'For the best experience, please use the latest version of Chrome, Firefox, Safari, or Edge.';
}
