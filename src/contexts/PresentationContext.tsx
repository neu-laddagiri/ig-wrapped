"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface PresentationContextValue {
  presentationMode: boolean;
  setPresentationMode: (v: boolean) => void;
  togglePresentationMode: () => void;
  /** Same as presentationMode: true while names and other sensitive details must be hidden. */
  hideSensitiveDetails: boolean;
  /** Not consumed yet — Story Mode's toggle lives in page state (storyHideNames). */
  storyPublicSafe: boolean;
  setStoryPublicSafe: (v: boolean) => void;
}

const PresentationContext = createContext<PresentationContextValue | null>(
  null
);

export function PresentationProvider({ children }: { children: ReactNode }) {
  const [presentationMode, setPresentationMode] = useState(false);
  const [storyPublicSafe, setStoryPublicSafe] = useState(true);

  const togglePresentationMode = useCallback(() => {
    setPresentationMode((v) => !v);
  }, []);

  const hideSensitiveDetails = presentationMode;

  const value = useMemo(
    () => ({
      presentationMode,
      setPresentationMode,
      togglePresentationMode,
      hideSensitiveDetails,
      storyPublicSafe,
      setStoryPublicSafe,
    }),
    [presentationMode, storyPublicSafe, togglePresentationMode, hideSensitiveDetails]
  );

  return (
    <PresentationContext.Provider value={value}>
      {children}
    </PresentationContext.Provider>
  );
}

export function usePresentationMode() {
  const ctx = useContext(PresentationContext);
  if (!ctx) {
    throw new Error("usePresentationMode must be used within PresentationProvider");
  }
  return ctx;
}
