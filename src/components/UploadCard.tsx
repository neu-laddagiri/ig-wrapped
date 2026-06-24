"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileArchive, Loader2, AlertCircle } from "lucide-react";

interface UploadCardProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  loadingText?: string;
  error?: string | null;
  fileName?: string | null;
}

export function UploadCard({
  onFileSelect,
  isLoading,
  loadingText,
  error,
  fileName,
}: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".zip")) {
        return;
      }
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
      className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl sm:p-8"
    >
      <div
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
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-[#DD2A7B]" />
            <p className="text-sm text-white/70">{loadingText ?? "Parsing…"}</p>
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
              className="mt-6 rounded-full bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#DD2A7B]/25 transition hover:opacity-90 hover:shadow-[#DD2A7B]/40"
            >
              {fileName ? "Upload a different file" : "Choose ZIP file"}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-white/35">
        Only JSON files are parsed. Media files are counted but not processed.
      </p>
    </motion.div>
  );
}
