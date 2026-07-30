import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase/client';

export type AuthMode = 'local' | 'loading' | 'signed-out' | 'signed-in';

interface AuthContextValue {
  mode: AuthMode;
  user: User | null;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  sendMagicLink: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<AuthMode>(isSupabaseConfigured ? 'loading' : 'local');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setMode('local');
      setUser(null);
      return;
    }

    let active = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.session) {
        setUser(null);
        setMode('signed-out');
        return;
      }
      setUser(data.session.user);
      setMode('signed-in');
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setMode(session ? 'signed-in' : 'signed-out');
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const client = getSupabaseClient();
    if (!client) return 'Supabase n’est pas configuré.';
    const { error } = await client.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const client = getSupabaseClient();
    if (!client) return 'Supabase n’est pas configuré.';
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
      },
    });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    await client.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ mode, user, signInWithPassword, sendMagicLink, signOut }),
    [mode, user, signInWithPassword, sendMagicLink, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
