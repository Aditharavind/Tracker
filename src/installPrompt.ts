import { useEffect, useState } from "react";

/**
 * Chrome's own install-prompt event. Not in the standard DOM lib types (it's
 * a Chromium-specific extension, never standardized), so it's declared here
 * rather than reached for with an `any`.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState =
  // Already running as the installed app -- nothing to offer.
  | { kind: "installed" }
  // Chrome/Edge/most Android browsers: the real, one-tap native prompt.
  | { kind: "promptable"; install: () => Promise<boolean> }
  // iOS has no install API at all (Apple has never shipped one, on any
  // browser there -- they all run Safari's WebKit underneath). The only way
  // on is Safari's own Share sheet, which nothing on the page can trigger.
  | { kind: "ios-manual" }
  // Desktop Firefox, or any browser that simply doesn't support installing
  // this as an app. Nothing useful to show.
  | { kind: "unavailable" };

export const isStandalone = (): boolean => {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari's own pre-standard flag -- display-mode alone doesn't
      // reliably report standalone there.
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
};

export const isIOS = (): boolean => {
  try {
    // Every browser on iOS is Safari underneath (Apple requires it), so
    // Chrome-on-iOS, Firefox-on-iOS etc. all lack the install API the exact
    // same way -- this deliberately doesn't try to single out real Safari.
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
  } catch {
    return false;
  }
};

/**
 * Whether -- and how -- this browser can add the app to the home screen.
 *
 * The install prompt is a browser feature the page can only ever *steer*, not
 * summon: `beforeinstallprompt` fires unpredictably (or never, on iOS and
 * some desktop browsers), and `preventDefault()` there is what stops the
 * browser showing its own mini-infobar immediately -- capturing the event is
 * what lets a real button in the Profile drawer trigger it on demand instead.
 */
export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return { kind: "installed" };

  if (deferred) {
    return {
      kind: "promptable",
      install: async () => {
        // A captured event is single-use -- browsers refuse a second
        // .prompt() call on the same one, so it's cleared either way rather
        // than left around to silently do nothing on a later tap.
        const event = deferred;
        setDeferred(null);
        await event.prompt();
        const { outcome } = await event.userChoice;
        return outcome === "accepted";
      },
    };
  }

  return isIOS() ? { kind: "ios-manual" } : { kind: "unavailable" };
}
