import './App.css';

const foundationItems = [
  'React and TypeScript application shell',
  'Versioned Zod document contract',
  'Puck and Moveable dependencies reserved for the visual editor',
  'Supabase boundary reserved for authentication, drafts, releases, and media',
  'Vitest, Playwright, and GitHub Actions foundations',
] as const;

export function App() {
  return (
    <main className="foundation-shell">
      <section className="foundation-card" aria-labelledby="foundation-title">
        <div className="foundation-brand">
          <span className="foundation-dot" aria-hidden="true" />
          TRESH
        </div>
        <p className="foundation-kicker">Étape 1</p>
        <h1 id="foundation-title">Fondation du véritable éditeur</h1>
        <p className="foundation-copy">
          Le dépôt est structuré. L’interface de Claude demeure une référence UX dans
          <code> prototypes/tresh-editor-v0.html</code>; elle n’est pas présentée comme une
          sauvegarde ou une publication réelle.
        </p>
        <ul>
          {foundationItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="foundation-status" role="status">
          Éditeur visuel non branché — aucune fausse publication.
        </p>
      </section>
    </main>
  );
}
