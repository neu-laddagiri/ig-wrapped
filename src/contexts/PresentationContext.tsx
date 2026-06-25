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
  /** Effective: hide names when presentation mode OR story mode public-safe */
  hideSensitiveDetails: boolean;
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
