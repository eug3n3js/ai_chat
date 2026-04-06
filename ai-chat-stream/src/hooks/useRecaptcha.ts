import { useEffect, useCallback } from "react";
import { RECAPTCHA_SITE_KEY } from "@/config";

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

let loadPromise: Promise<void> | null = null;

function waitForGrecaptchaReady(timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (window.grecaptcha?.ready) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("reCAPTCHA timeout"));
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

function ensureRecaptchaLoaded(siteKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("reCAPTCHA: browser only"));
  }
  if (!siteKey) {
    return Promise.reject(new Error("RECAPTCHA_SITE_KEY is empty"));
  }
  if (window.grecaptcha?.ready) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    let script = document.querySelector<HTMLScriptElement>(
      `script[src*="google.com/recaptcha/api.js"]`
    );

    if (!script) {
      script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      await new Promise<void>((resolve, reject) => {
        script!.addEventListener("load", () => resolve(), { once: true });
        script!.addEventListener(
          "error",
          () => reject(new Error("reCAPTCHA script failed")),
          { once: true }
        );
      });
    }

    await waitForGrecaptchaReady();
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

export function useRecaptcha() {
  useEffect(() => {
    if (RECAPTCHA_SITE_KEY) {
      ensureRecaptchaLoaded(RECAPTCHA_SITE_KEY).catch(() => {});
    }
  }, []);

  const getToken = useCallback((): Promise<string> => {
    return ensureRecaptchaLoaded(RECAPTCHA_SITE_KEY).then(
      () =>
        new Promise((resolve, reject) => {
          window.grecaptcha.ready(() => {
            void (async () => {
              try {
                const token = await window.grecaptcha.execute(
                  RECAPTCHA_SITE_KEY,
                  { action: "auth" }
                );
                resolve(token);
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            })();
          });
        })
    );
  }, []);

  return { getToken };
}
