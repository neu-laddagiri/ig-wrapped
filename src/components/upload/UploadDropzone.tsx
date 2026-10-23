"use client";

import { useCallback, useId, useRef, useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { MAX_ZIP_BYTES } from "@/lib/zipParser";
import { StoryRing } from "@/components/ig/Avatar";

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
  onTryDemo?: () => void;
  onShowGuide?: () => void;
  isLoading?: boolean;
  loadingText?: string;
  /** 0–100 while parsing. */
  loadingProgress?: number;
  /** Stops the in-flight parse. */
  onCancel?: () => void;
  error?: string | null;
  /** "modal" is the Create window; "card" is the compact landing-page form. */
  variant?: "modal" | "card";
}

/**
 * Drop zone for the export ZIP, modeled on Instagram's "Create new post"
 * window. Files are validated here so huge or wrong files fail fast.
 */
export function UploadDropzone({
  onFileSelect,
  onTryDemo,
  onShowGuide,
  isLoading,
  loadingText,
  loadingProgress,
  onCancel,
  error,
  variant = "modal",
}: UploadDropzoneProps) {
  const progress = Math.max(0, Math.min(100, loadingProgress ?? 0));
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const errorId = useId();
  const shownError = localError ?? error ?? null;

  const handleFiles = useCallback(
    (files: FileList | null | undefined) => {
      const list = files ? Array.from(files) : [];
      if (list.length === 0) return;
      const zip = list.find((f) => f.name.toLowerCase().endsWith(".zip"));
      if (!zip) {
        setNotice(null);
        setLocalError(
          list.length > 1
            ? "None of those files is a .zip. Upload the ZIP export Instagram sent you."
            : `“${list[0].name}” isn't a .zip file. Upload the ZIP export Instagram sent you.`
        );
        return;
      }
      // Fail fast here instead of after reading a huge file into memory.
      if (zip.size === 0 || zip.size > MAX_ZIP_BYTES) {
        setNotice(null);
        setLocalError(
          zip.size === 0
            ? "This ZIP is empty. Choose your Instagram export."
            : "This ZIP is over 512 MB. Export Instagram data as JSON without media and try again."
        );
        return;
      }
      setLocalError(null);
      setNotice(
        list.length > 1
          ? `${list.length} files dropped — loading ${zip.name} only. Upload one export ZIP at a time.`
          : null
      );
      onFileSelect(zip);
    },
    [onFileSelect]
  );

  const openPicker = () => {
    if (!isLoading) inputRef.current?.click();
  };

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        if (isLoading) return;
        dragDepth.current += 1;
        setIsDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = isLoading ? "none" : "copy";
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setIsDragging(false);
        if (isLoading) return;
        handleFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center text-center transition-colors ${
        variant === "modal" ? "px-6 py-10" : "rounded-lg"
      } ${isDragging ? "bg-ig-hover" : ""}`}
      aria-describedby={shownError ? errorId : undefined}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          // Reset so choosing the same file again still fires onChange.
          e.target.value = "";
        }}
      />

      {isLoading ? (
        <div className="flex w-full max-w-xs flex-col items-center" aria-live="polite">
          <StoryRing state="loading" pad={5}>
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-ig-elevated">
              <ExportGlyph className="h-9 w-9" />
            </span>
          </StoryRing>
          <p className="mt-5 text-lg">{loadingText ?? "Reading your export…"}</p>
          <div
            className="mt-4 h-1 w-full overflow-hidden rounded-full bg-ig-secondary"
            role="progressbar"
            aria-label="Export parsing progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="h-full rounded-full bg-ig-gradient transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs tabular-nums text-ig-muted">{progress}%</p>
          {onCancel && (
            <button type="button" onClick={onCancel} className="mt-4 text-sm font-semibold text-ig-blue hover:text-ig-link">
              Cancel
            </button>
          )}
        </div>
      ) : variant === "card" ? (
        <div className="w-full">
          <button
            type="button"
            onClick={openPicker}
            className="h-9 w-full rounded-lg bg-ig-blue text-sm font-semibold text-white hover:bg-ig-blue-hover"
          >
            {isDragging ? "Drop it here" : "Upload your export"}
          </button>
          <p className="mt-2 text-xs text-ig-muted">or drag the .zip onto this card</p>
          {onTryDemo && (
            <>
              <div className="my-5 flex items-center gap-4 text-[13px] font-semibold text-ig-muted">
                <span className="h-px flex-1 bg-ig-border" />
                OR
                <span className="h-px flex-1 bg-ig-border" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  setNotice(null);
                  onTryDemo();
                }}
                className="text-sm font-semibold text-ig-blue hover:text-ig-link"
              >
                Try it with demo data
              </button>
            </>
          )}
          {onShowGuide && (
            <button
              type="button"
              onClick={onShowGuide}
              className="mt-4 block w-full text-xs text-ig-link hover:underline"
            >
              How do I get my Instagram export?
            </button>
          )}
        </div>
      ) : (
        <>
          <ExportGlyph className={`h-24 w-24 ${isDragging ? "text-ig-blue" : ""}`} />
          <p className="mt-4 text-xl">Drag your Instagram export here</p>
          <p className="mt-1 text-sm text-ig-muted">
            The .zip Instagram sends you, in JSON format. It never leaves your browser.
          </p>
          <button
            type="button"
            onClick={openPicker}
            className="mt-6 rounded-lg bg-ig-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ig-blue-hover"
          >
            Select from computer
          </button>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            {onTryDemo && (
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  setNotice(null);
                  onTryDemo();
                }}
                className="font-semibold text-ig-blue hover:text-ig-link"
              >
                Try it with demo data
              </button>
            )}
            {onShowGuide && (
              <button type="button" onClick={onShowGuide} className="font-semibold text-fg hover:opacity-70">
                How do I get my export?
              </button>
            )}
          </div>
        </>
      )}

      {notice && (
        <p role="status" className="mt-4 flex items-start gap-2 text-xs text-ig-warn">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{notice}</span>
        </p>
      )}
      {shownError && (
        <p id={errorId} role="alert" className="mt-4 flex max-w-sm items-start gap-2 text-left text-sm text-ig-bad">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{shownError}</span>
        </p>
      )}
    </div>
  );
}

/** A zipped folder with a heart, in Instagram's outline icon style. */
export function ExportGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M14 30a8 8 0 0 1 8-8h16l7 8h29a8 8 0 0 1 8 8v30a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8Z" />
      <path d="M48 38v4M48 46v4M48 54v4" />
      <path d="M58 60.5c-3.3-3-6-5.3-6-8.2a3.6 3.6 0 0 1 6-2.6 3.6 3.6 0 0 1 6 2.6c0 2.9-2.7 5.2-6 8.2Z" transform="translate(4 -2)" />
    </svg>
  );
}
