"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ig-bg px-6 text-fg">
      <div className="max-w-md rounded-xl border border-ig-border bg-ig-subtle p-8 text-center">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-fg">
          IG Wrapped hit an unexpected error. Try again, or reload the page and
          upload your export again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-ig-hover"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
