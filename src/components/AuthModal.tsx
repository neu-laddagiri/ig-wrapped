"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type AuthMode = "signin" | "signup" | "reset";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: AuthMode;
}

export function AuthModal({
  open,
  onClose,
  onSuccess,
  initialMode = "signin",
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setError(null);
    setSuccess(null);
    setPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isSupabaseConfigured()) {
      setError("Cloud save is not configured yet.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Cloud save is not configured yet.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          { redirectTo: `${window.location.origin}/` }
        );
        if (resetError) throw resetError;
        setSuccess("Check your email for a password reset link.");
        return;
      }

      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setSuccess("Account created! You can now save your analyses.");
        onSuccess?.();
        setTimeout(onClose, 1200);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Authentication failed."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0c0c12]/95 p-6 shadow-2xl backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="text-xl font-semibold text-white">
            {mode === "signin" && "Sign in"}
            {mode === "signup" && "Create account"}
            {mode === "reset" && "Reset password"}
          </h2>
          <p className="mt-1 text-sm text-white/45">
            Optional — only needed to save your full analysis across devices.
          </p>

          {!isSupabaseConfigured() ? (
            <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
              Cloud save is not configured yet. Add Supabase environment
              variables to enable accounts.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-[#DD2A7B]/40"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {mode !== "reset" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-[#DD2A7B]/40"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}

              {success && (
                <p className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4] py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#DD2A7B]/20 transition hover:opacity-90 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signin" && "Sign in"}
                {mode === "signup" && "Create account"}
                {mode === "reset" && "Send reset link"}
              </button>
            </form>
          )}

          {isSupabaseConfigured() && (
            <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-white/40">
              {mode === "signin" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setMode("signup");
                    }}
                    className="hover:text-white/70"
                  >
                    Need an account? Sign up
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setMode("reset");
                    }}
                    className="hover:text-white/70"
                  >
                    Forgot password?
                  </button>
                </>
              )}
              {mode === "signup" && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMode("signin");
                  }}
                  className="hover:text-white/70"
                >
                  Already have an account? Sign in
                </button>
              )}
              {mode === "reset" && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMode("signin");
                  }}
                  className="hover:text-white/70"
                >
                  Back to sign in
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
