"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SetNewPasswordModal } from "@/components/AuthModal";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Auth events re-emit the same user (e.g. on every tab focus); keep the old object. */
function sameUser(a: User | null, b: User | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.email === b.email && a.updated_at === b.updated_at;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const setUser = useCallback((next: User | null) => {
    setUserState((prev) => (sameUser(prev, next) ? prev : next));
  }, []);

  const refreshUser = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setUser(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase.auth.getUser();
    setUser(data.user ?? null);
    setLoading(false);
  }, [setUser]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    if (!supabase) {
      // Env looked configured but no client could be made — run local-only.
      void Promise.resolve().then(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_OUT") setPasswordRecovery(false);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setUser]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
  }, [setUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isConfigured: isSupabaseConfigured(),
      signOut,
      refreshUser,
    }),
    [user, loading, signOut, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {passwordRecovery && (
        <SetNewPasswordModal open onClose={() => setPasswordRecovery(false)} />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
