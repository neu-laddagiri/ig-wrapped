"use client";

import { useCallback, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileArchive, Loader2, AlertCircle, Info } from "lucide-react";

interface UploadCardProps {
  onFileSelect: (file: File) => void;
  onTryDemo?: () => void;
  isLoading?: boolean;
  loadingText?: string;
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
  error,
  fileName,
  compact = false,
}: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const errorId = useId();

  const shownError = localError ?? error ?? null;
  // A file name with an error means the last upload failed, not that it loaded.
  const showLoaded = Boolean(fileName) && !error;

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

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset so choosing the same file again still fires onChange.
    e.target.value = "";
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".zip,application/zip"
      className="hidden"
      onChange={onInputChange}
    />
  );

  const noticeLine = notice && (
    <p
      role="status"
      className="mt-3 flex items-start gap-2 text-xs text-amber-200/90"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{notice}</span>
    </p>
  );

  if (compact && fileName && !isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 backdrop-blur-sm sm:px-5"
      >
        {fileInput}
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
            onClick={openPicker}
            className="shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
          >
            Upload different file
          </button>
        </div>
        {noticeLine}
        {shownError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{shownError}</span>
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
      {fileInput}
      <div
        role="button"
        tabIndex={isLoading ? -1 : 0}
        aria-disabled={isLoading || undefined}
        aria-label={
          isLoading
            ? "Parsing your export"
            : "Choose your Instagram export ZIP, or drop it here"
        }
        aria-describedby={shownError ? errorId : undefined}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
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
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 outline-none transition-all focus-visible:ring-2 focus-visible:ring-[#DD2A7B]/50 ${
          isLoading ? "cursor-wait" : "cursor-pointer"
        } ${
          isDragging
            ? "border-[#DD2A7B]/60 bg-[#DD2A7B]/5"
            : "border-white/15 bg-white/[0.02] hover:border-white/25"
        }`}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-[#DD2A7B]" />
            <p className="text-sm text-white/70">{loadingText ?? "Parsing…"}</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] shadow-lg shadow-[#DD2A7B]/20">
              {showLoaded ? (
                <FileArchive className="h-7 w-7 text-white" />
              ) : (
                <Upload className="h-7 w-7 text-white" />
              )}
            </div>

            <h3 className="text-lg font-semibold text-white">
              {showLoaded ? "Export loaded" : "Upload your Instagram export"}
            </h3>

            <p className="mt-2 max-w-md text-center text-sm text-white/45">
              {showLoaded
                ? fileName
                : "Drop your official Instagram data export ZIP here, or click to browse."}
            </p>

            <span className="mt-6 rounded-full animated-gradient-bg px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
              {showLoaded ? "Upload a different file" : "Choose ZIP file"}
            </span>
          </>
        )}
      </div>

      {!showLoaded && !isLoading && onTryDemo && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setLocalError(null);
              setNotice(null);
              onTryDemo();
            }}
            className="rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
          >
            Try Demo Data
          </button>
        </div>
      )}

      {noticeLine}

      {shownError && (
        <div
          id={errorId}
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{shownError}</span>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-white/35">
        Only JSON files are parsed. Media files are counted but not processed.
      </p>
    </motion.div>
  );
}
