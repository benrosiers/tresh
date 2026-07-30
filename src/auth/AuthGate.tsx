import type { PropsWithChildren } from 'react';
import { useAuth } from './AuthProvider';
import { LoginScreen } from './LoginScreen';
import './auth.css';

export function AuthGate({ children }: PropsWithChildren) {
  const { mode } = useAuth();

  if (mode === 'loading') {
    return (
      <main className="auth-screen">
        <div className="auth-loading"><span aria-hidden="true" /> Ouverture de Tresh…</div>
      </main>
    );
  }

  if (mode === 'signed-out') return <LoginScreen />;
  return children;
}
