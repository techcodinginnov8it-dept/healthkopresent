"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface UseActiveCallGuardOptions {
  isCallActive: boolean;
  onEndCall?: () => void;
}

export function useActiveCallGuard({ isCallActive }: UseActiveCallGuardOptions) {
  const [showWarningModal, setShowWarningModal] = useState(false);
  const originalTitleRef = useRef<string>("");
  const titleIntervalRef = useRef<number | null>(null);

  // 1. Intercept beforeunload (window/tab close, refresh, browser quit)
  useEffect(() => {
    if (!isCallActive) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You are currently in an active consultation. Please end the call before leaving.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isCallActive]);

  // 2. Intercept browser back/forward buttons (popstate)
  useEffect(() => {
    if (!isCallActive) return;

    // Push a guard state onto history stack
    window.history.pushState({ callGuardActive: true }, "", window.location.href);

    const handlePopState = (_e: PopStateEvent) => {
      // Prevent going back, restore guard state
      window.history.pushState({ callGuardActive: true }, "", window.location.href);
      setShowWarningModal(true);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isCallActive]);

  // 3. Tab visibility / minimize warning (pulse tab title when minimized)
  useEffect(() => {
    if (!isCallActive) {
      if (titleIntervalRef.current) {
        window.clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = null;
      }
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current;
        originalTitleRef.current = "";
      }
      return;
    }

    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        let isAlert = true;
        if (!titleIntervalRef.current) {
          titleIntervalRef.current = window.setInterval(() => {
            document.title = isAlert ? "🔴 ACTIVE CALL - HealthKo" : originalTitleRef.current || "HealthKo";
            isAlert = !isAlert;
          }, 1000);
        }
      } else {
        if (titleIntervalRef.current) {
          window.clearInterval(titleIntervalRef.current);
          titleIntervalRef.current = null;
        }
        if (originalTitleRef.current) {
          document.title = originalTitleRef.current;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (titleIntervalRef.current) {
        window.clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = null;
      }
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current;
      }
    };
  }, [isCallActive]);

  const closeWarningModal = useCallback(() => {
    setShowWarningModal(false);
  }, []);

  return {
    showWarningModal,
    closeWarningModal,
  };
}
