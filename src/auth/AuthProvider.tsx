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

export interface AccountProfile {
  displayName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
}

interface AuthContextValue {
  mode: AuthMode;
  user: User | null;
  profile: AccountProfile;
  passwordRecovery: boolean;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  sendMagicLink: (email: string) => Promise<string | null>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updateDisplayName: (displayName: string) => Promise<string | null>;
  uploadAvatar: (file: File) => Promise<string | null>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<string | null>;
  dismissPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

const emptyProfile: AccountProfile = {
  displayName: '',
  avatarPath: null,
  avatarUrl: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

function metadataString(user: User, key: string): string {
  const value = user.user_metadata?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function profileFromUser(user: User, avatarUrl: string | null): AccountProfile {
  return {
    displayName: metadataString(user, 'display_name') || user.email?.split('@')[0] || 'Compte',
    avatarPath: metadataString(user, 'avatar_path') || null,
    avatarUrl,
  };
}

async function createAvatarUrl(user: User): Promise<string | null> {
  const client = getSupabaseClient();
  const avatarPath = metadataString(user, 'avatar_path');
  if (!client || !avatarPath) return null;

  const { data, error } = await client.storage
    .from('avatars')
    .createSignedUrl(avatarPath, 60 * 60);

  if (error) return null;
  return data.signedUrl;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<AuthMode>(isSupabaseConfigured ? 'loading' : 'local');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AccountProfile>(emptyProfile);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const applyUser = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);
    if (!nextUser) {
      setProfile(emptyProfile);
      return;
    }
    const avatarUrl = await createAvatarUrl(nextUser);
    setProfile(profileFromUser(nextUser, avatarUrl));
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setMode('local');
      setUser(null);
      setProfile(emptyProfile);
      return;
    }

    let active = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.session) {
        setUser(null);
        setProfile(emptyProfile);
        setMode('signed-out');
        return;
      }
      setMode('signed-in');
      void applyUser(data.session.user);
    });

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setMode(session ? 'signed-in' : 'signed-out');
      void applyUser(session?.user ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [applyUser]);

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

  const requestPasswordReset = useCallback(async (email: string) => {
    const client = getSupabaseClient();
    if (!client) return 'Supabase n’est pas configuré.';
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return error?.message ?? null;
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const client = getSupabaseClient();
    if (!client || !user) return 'Aucun compte connecté.';
    const normalized = displayName.trim();
    if (normalized.length < 2 || normalized.length > 80) {
      return 'Le nom doit contenir entre 2 et 80 caractères.';
    }

    const { data, error } = await client.auth.updateUser({
      data: {
        ...user.user_metadata,
        display_name: normalized,
      },
    });
    if (error) return error.message;
    await applyUser(data.user);
    return null;
  }, [applyUser, user]);

  const uploadAvatar = useCallback(async (file: File) => {
    const client = getSupabaseClient();
    if (!client || !user) return 'Aucun compte connecté.';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return 'Choisis une image JPG, PNG ou WebP.';
    }
    if (file.size > 5 * 1024 * 1024) return 'La photo doit faire 5 Mo ou moins.';

    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensionByType[file.type];
    if (!extension) return 'Format de photo non pris en charge.';

    const previousPath = metadataString(user, 'avatar_path');
    const avatarPath = `${user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await client.storage
      .from('avatars')
      .upload(avatarPath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) return uploadError.message;

    const { data, error: updateError } = await client.auth.updateUser({
      data: {
        ...user.user_metadata,
        avatar_path: avatarPath,
      },
    });
    if (updateError) {
      await client.storage.from('avatars').remove([avatarPath]);
      return updateError.message;
    }

    if (previousPath && previousPath !== avatarPath) {
      await client.storage.from('avatars').remove([previousPath]);
    }
    await applyUser(data.user);
    return null;
  }, [applyUser, user]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const client = getSupabaseClient();
    if (!client || !user?.email) return 'Aucun compte connecté.';
    if (newPassword.length < 12) return 'Le nouveau mot de passe doit contenir au moins 12 caractères.';

    if (!passwordRecovery) {
      const { error: signInError } = await client.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) return 'Le mot de passe actuel est incorrect.';
    }

    const { data, error } = await client.auth.updateUser({ password: newPassword });
    if (error) return error.message;
    setPasswordRecovery(false);
    await applyUser(data.user);
    return null;
  }, [applyUser, passwordRecovery, user]);

  const dismissPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);

  const signOut = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setPasswordRecovery(false);
    await client.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      mode,
      user,
      profile,
      passwordRecovery,
      signInWithPassword,
      sendMagicLink,
      requestPasswordReset,
      updateDisplayName,
      uploadAvatar,
      changePassword,
      dismissPasswordRecovery,
      signOut,
    }),
    [
      mode,
      user,
      profile,
      passwordRecovery,
      signInWithPassword,
      sendMagicLink,
      requestPasswordReset,
      updateDisplayName,
      uploadAvatar,
      changePassword,
      dismissPasswordRecovery,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
