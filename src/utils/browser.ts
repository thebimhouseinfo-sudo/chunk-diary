/**
 * Browser Detection Utility
 */

export interface BrowserInfo {
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
}

let cachedBrowserInfo: BrowserInfo | null = null;

export function getBrowserInfo(): BrowserInfo {
  if (cachedBrowserInfo) {
    return cachedBrowserInfo;
  }

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    cachedBrowserInfo = {
      isSafari: false,
      isChrome: false,
      isFirefox: false,
      isEdge: false,
      isIOS: false,
      isAndroid: false,
      isMobile: false
    };
    return cachedBrowserInfo;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform;
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // Detect iOS (including iPad on iOS 13+)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (platform === 'MacIntel' && maxTouchPoints > 1);

  // Detect Android
  const isAndroid = /android/i.test(navigator.userAgent);

  // Detect mobile
  const isMobile = isIOS || isAndroid || /mobile/i.test(userAgent);

  // Detect Safari (must check before Chrome since Chrome UA contains Safari)
  // Safari: contains 'safari' but NOT 'chrome', 'chromium', 'edg', or 'android'
  const isSafari = /^((?!chrome|android|crios|edg|msie|trident).)*safari/i.test(navigator.userAgent) && !isAndroid;

  // Detect Chrome (but not Edge or other Chromium-based browsers)
  const isChrome = /chrome/i.test(userAgent) && !/edg/i.test(userAgent) && !/opr/i.test(userAgent);

  // Detect Firefox
  const isFirefox = /firefox/i.test(userAgent);

  // Detect Edge
  const isEdge = /edg/i.test(userAgent);

  cachedBrowserInfo = {
    isSafari,
    isChrome,
    isFirefox,
    isEdge,
    isIOS,
    isAndroid,
    isMobile
  };

  return cachedBrowserInfo;
}

/**
 * Get the appropriate scale factor for active state based on browser
 * Safari auto-optimizes touch feedback, so we don't apply additional scaling
 * Other browsers get reduced scaling (90% instead of 95%)
 */
export function getActiveScaleClass(): string {
  const browser = getBrowserInfo();
  
  // Safari has native touch feedback, no need for CSS scale
  if (browser.isSafari) {
    return '';
  }
  
  // For other browsers, use reduced scale (90% = scale-90)
  return 'active:scale-90';
}

/**
 * Check if browser needs custom active state styling
 */
export function needsCustomActiveState(): boolean {
  const browser = getBrowserInfo();
  return !browser.isSafari;
}

/**
 * Replace active:scale-95 with browser-appropriate scale class
 * Usage: className={`... ${getActiveScale('active:scale-95')}`}
 */
export function getActiveScale(originalScaleClass: string = 'active:scale-95'): string {
  const browser = getBrowserInfo();
  
  // Safari has native touch feedback, no need for CSS scale
  if (browser.isSafari) {
    return '';
  }
  
  // For other browsers, use reduced scale (90% instead of 95%)
  // If original was scale-95, use scale-90; otherwise keep the original
  if (originalScaleClass.includes('scale-95')) {
    return 'active:scale-90';
  }
  if (originalScaleClass.includes('scale-90')) {
    return 'active:scale-85';
  }
  return originalScaleClass;
}

