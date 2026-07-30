import { AuthGate, AuthProvider } from '../auth';
import { EditorApp } from '../editor';

export function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <EditorApp />
      </AuthGate>
    </AuthProvider>
  );
}
