"use client";

import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, X } from "lucide-react";
import { useAccessibleDialog } from "@/components/useAccessibleDialog";

const SIZES = {
  sm: "max-w-[400px]",
  md: "max-w-[548px]",
  lg: "max-w-[760px]",
  xl: "max-w-[960px]",
} as const;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: keyof typeof SIZES;
  onBack?: () => void;
  headerAction?: ReactNode;
  /** Classes for the scrolling body; defaults to no padding. */
  bodyClassName?: string;
}

/**
 * Instagram-style modal: dimmed page, centered rounded card with a
 * centered title bar. Portaled to <body> so fixed positioning is never
 * trapped by a transformed ancestor.
 */
export function Modal(props: ModalProps) {
  if (!props.open || typeof document === "undefined") return null;
  return createPortal(<ModalCard {...props} />, document.body);
}

function ModalCard({
  onClose,
  title,
  children,
  size = "md",
  onBack,
  headerAction,
  bodyClassName = "",
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open: true, onClose });

  return (
    <div
      className="ig-fade-up fixed inset-0 z-[80] flex items-center justify-center bg-[var(--ig-overlay)] p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 hidden p-2 text-white sm:block"
      >
        <X className="h-7 w-7" strokeWidth={2} />
      </button>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex max-h-[90vh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-xl bg-ig-elevated text-fg shadow-2xl outline-none`}
      >
        <div className="relative flex h-[43px] shrink-0 items-center justify-center border-b border-ig-border px-12">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="absolute left-2 rounded-full p-2 hover:bg-ig-hover"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <h2 id={titleId} className="truncate text-base font-semibold">
            {title}
          </h2>
          <div className="absolute right-2 flex items-center">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-2 hover:bg-ig-hover sm:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
