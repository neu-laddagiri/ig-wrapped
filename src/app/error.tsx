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
    <div className="flex min-h-screen items-center justify-center bg-[#050509] px-6 text-white">
      <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-white/60">
          IG Wrapped hit an unexpected error. Try again, or reload the page and
          upload your export again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-white/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
