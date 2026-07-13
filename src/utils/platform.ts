// Detect iOS (iPhone/iPad/iPod). iPadOS 13+ reports as "MacIntel" but with
// touch support, so we also check for touch points to catch iPads.
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;
  const isIphoneOrIpod = /iPhone|iPod/.test(ua);
  const isIpadUA = /iPad/.test(ua);
  const isIpadOS13Plus = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return isIphoneOrIpod || isIpadUA || isIpadOS13Plus;
}
