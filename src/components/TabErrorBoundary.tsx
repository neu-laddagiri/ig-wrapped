"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Shown in the fallback, e.g. the tab name. */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Keeps a crash in one dashboard tab from unmounting the page — the parsed
 * export lives in page state, so a page-level crash would force a re-upload.
 * Key it by tab so switching tabs clears the error.
 */
export class TabErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Tab render failed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-5 py-6 text-sm text-fg">
        <p className="font-medium text-fg">
          {this.props.label ? `${this.props.label} couldn't be displayed.` : "This section couldn't be displayed."}
        </p>
        <p className="mt-1 text-ig-muted">
          Something in this export tripped up this view. Your other tabs still
          work — try another tab or reload the page.
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-4 rounded-full border border-ig-border px-4 py-1.5 text-xs text-fg hover:bg-ig-hover"
        >
          Try again
        </button>
      </div>
    );
  }
}
