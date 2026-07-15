"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileArchive, Loader2, AlertCircle } from "lucide-react";
import { MAX_ZIP_BYTES } from "@/lib/zipParser";

interface UploadCardProps {
  onFileSelect: (file: File) => void;
  onTryDemo?: () => void;
  isLoading?: boolean;
  loadingText?: string;
  loadingProgress?: number;
  onCancel?: () => void;
  error?: string | null;
  fileName?: string | null;
  /** Compact layout after a successful upload */
  compact?: boolean;
}

export function UploadCard({
  onFileSelect,
  onTryDemo,
  isLoading,
  loadingText,
  loadingProgress,
  onCancel,
  error,
  fileName,
  compact = false,
}: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const visibleError = validationError ?? error;
  const progress = Math.max(0, Math.min(100, loadingProgress ?? 0));

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".zip")) {
        setValidationError("Choose the .zip file downloaded from Instagram.");
        return;
      }
      if (file.size === 0) {
        setValidationError("This ZIP is empty. Choose your Instagram export.");
        return;
      }
      if (file.size > MAX_ZIP_BYTES) {
        setValidationError(
          "This ZIP is over 512 MB. Export Instagram data as JSON without media and try again."
        );
        return;
      }
      setValidationError(null);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  if (compact && fileName && !isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 backdrop-blur-sm sm:px-5"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4]">
              <FileArchive className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-200/90">
                Export loaded
              </p>
              <p className="truncate text-xs text-white/50">{fileName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
          >
            Upload different file
          </button>
        </div>
        {visibleError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{visibleError}</span>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
      className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl sm:p-8"
    >
      <div
        aria-busy={isLoading || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 transition-all ${
          isDragging
            ? "border-[#DD2A7B]/60 bg-[#DD2A7B]/5"
            : "border-white/15 bg-white/[0.02] hover:border-white/25"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.currentTarget.value = "";
          }}
        />

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex w-full max-w-sm flex-col items-center gap-4 text-center"
          >
            <Loader2 className="h-10 w-10 animate-spin text-[#DD2A7B]" />
            <p className="text-sm text-white/70">{loadingText ?? "Parsing…"}</p>
            <div className="w-full">
              <div
                role="progressbar"
                aria-label="Instagram export parsing progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-2 overflow-hidden rounded-full bg-white/10"
              >
                <div
                  className="h-full rounded-full animated-gradient-bg transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs tabular-nums text-white/50">
                {progress}% complete
              </p>
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="min-h-11 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-white/70 hover:bg-white/5"
              >
                Cancel
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] shadow-lg shadow-[#DD2A7B]/20">
              {fileName ? (
                <FileArchive className="h-7 w-7 text-white" />
              ) : (
                <Upload className="h-7 w-7 text-white" />
              )}
            </div>

            <h3 className="text-lg font-semibold text-white">
              {fileName ? "Export loaded" : "Upload your Instagram export"}
            </h3>

            <p className="mt-2 max-w-md text-center text-sm text-white/45">
              {fileName
                ? fileName
                : "Drop your official Instagram data export ZIP here, or click to browse."}
            </p>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-6 rounded-full animated-gradient-bg px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {fileName ? "Upload a different file" : "Choose ZIP file"}
            </button>
            {!fileName && onTryDemo && (
              <button
                type="button"
                onClick={() => {
                  setValidationError(null);
                  onTryDemo();
                }}
                className="mt-3 rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
              >
                Try Demo Data
              </button>
            )}
          </>
        )}
      </div>

      {visibleError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{visibleError}</span>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-white/35">
        Only JSON files are parsed. Media files are counted but not processed.
      </p>
    </motion.div>
  );
}
