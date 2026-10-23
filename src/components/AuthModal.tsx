"use client";

import { useId, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Mail, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useAccessibleDialog } from "@/components/useAccessibleDialog";

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
  const titleId = useId();
  const descriptionId = useId();
  const emailId = useId();
  const passwordId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    open,
    onClose,
    initialFocusRef: emailRef,
  });

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
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        // No session means the project requires email confirmation first.
        if (!data.session) {
          setSuccess("Check your email to confirm your account, then sign in.");
          setPassword("");
          return;
        }
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
      <div className="fixed inset-0 z-[86] flex items-center justify-center p-4">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : undefined}
          className="absolute inset-0 bg-black/70"
          onClick={onClose}
          aria-hidden="true"
        />
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          initial={
            prefersReducedMotion
              ? false
              : { opacity: 0, scale: 0.95, y: 12 }
          }
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={prefersReducedMotion ? { duration: 0 } : undefined}
          className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-ig-border bg-ig-elevated p-6 shadow-2xl"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account dialog"
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-lg text-fg transition hover:bg-ig-hover hover:text-fg"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          <h2 id={titleId} className="pr-12 text-xl font-semibold text-fg">
            {mode === "signin" && "Log in to IG Wrapped"}
            {mode === "signup" && "Create an IG Wrapped account"}
            {mode === "reset" && "Reset password"}
          </h2>
          <p id={descriptionId} className="mt-1 pr-10 text-sm text-fg">
            Optional — only needed to save your analysis across devices.
          </p>
          {/* The UI looks like Instagram, so say plainly this is a separate account. */}
          <p className="mt-3 rounded-lg bg-ig-secondary px-3 py-2 text-xs leading-relaxed text-fg">
            <span className="font-semibold">This isn&apos;t your Instagram login.</span> Use an
            email and a new password just for IG Wrapped — never your Instagram password.
          </p>

          {!isSupabaseConfigured() ? (
            <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-ig-warn">
              Cloud save is not configured yet. Add Supabase environment
              variables to enable accounts.
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4"
              aria-busy={loading}
            >
              <div>
                <label
                  htmlFor={emailId}
                  className="mb-1.5 block text-xs font-medium text-fg"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ig-muted"
                    aria-hidden="true"
                  />
                  <input
                    ref={emailRef}
                    id={emailId}
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-ig-border bg-ig-secondary py-2.5 pl-10 pr-3 text-sm text-fg outline-none focus:border-ig-muted"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {mode !== "reset" && (
                <div>
                  <label
                    htmlFor={passwordId}
                    className="mb-1.5 block text-xs font-medium text-fg"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ig-muted"
                      aria-hidden="true"
                    />
                    <input
                      id={passwordId}
                      type="password"
                      required
                      minLength={6}
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-ig-border bg-ig-secondary py-2.5 pl-10 pr-3 text-sm text-fg outline-none focus:border-ig-muted"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-ig-bad"
                >
                  {error}
                </p>
              )}

              {success && (
                <p
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-ig-good"
                >
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full animated-gradient-bg py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {loading && (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {mode === "signin" && "Sign in"}
                {mode === "signup" && "Create account"}
                {mode === "reset" && "Send reset link"}
              </button>
            </form>
          )}

          {isSupabaseConfigured() && (
            <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-ig-muted">
              {mode === "signin" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setMode("signup");
                    }}
                    className="hover:text-fg"
                  >
                    Need an account? Sign up
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setMode("reset");
                    }}
                    className="hover:text-fg"
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
                  className="hover:text-fg"
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
                  className="hover:text-fg"
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

interface SetNewPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

/** Shown after a password-reset link signs the user in (PASSWORD_RECOVERY). */
export function SetNewPasswordModal({ open, onClose }: SetNewPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("Cloud save is not configured yet.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[87] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-ig-border bg-ig-elevated p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-ig-muted transition hover:bg-ig-hover hover:text-fg"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold text-fg">Set a new password</h2>
        <p className="mt-1 text-sm text-ig-muted">
          You opened a password reset link. Choose a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {[
            { label: "New password", value: password, onChange: setPassword },
            { label: "Confirm new password", value: confirmPassword, onChange: setConfirmPassword },
          ].map((field) => (
            <div key={field.label}>
              <label className="mb-1.5 block text-xs font-medium text-ig-muted">
                {field.label}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ig-muted" />
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="w-full rounded-lg border border-ig-border bg-ig-secondary py-2.5 pl-10 pr-3 text-sm text-fg outline-none focus:border-ig-muted"
                  placeholder="••••••••"
                />
              </div>
            </div>
          ))}

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-ig-bad">
              {error}
            </p>
          )}

          {success && (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-ig-good">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Password updated.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || success}
            className="flex w-full items-center justify-center gap-2 rounded-full animated-gradient-bg py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}
