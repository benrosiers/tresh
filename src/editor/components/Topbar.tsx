import { useEffect, useMemo, useState } from 'react';
import { AccountModal, useAuth } from '../../auth';
import { getPage } from '../model/documentOps';
import type { Breakpoint } from '../model/siteDocument';
import { useSiteWorkspace } from '../../sites';
import { useEditor } from '../state/editorStore';
import { PageManagerModal } from './PageManagerModal';
import { SiteManagerModal } from './SiteManagerModal';
import './desktopVault.css';

const breakpoints: Array<{ id: Breakpoint; label: string }> = [
  { id: 'desktop', label: 'Bureau' },
  { id: 'tablet', label: 'Tablette' },
  { id: 'mobile', label: 'Mobile' },
];

function SaveState() {
  const { state } = useEditor();
  const { mode } = useAuth();

  let label = 'Brouillon local';
  let tone = '';
  let title = 'Le brouillon est enregistré dans ce navigateur.';

  if (mode === 'signed-in') {
    if (state.cloud.status === 'loading') label = 'Chargement du brouillon…';
    if (state.cloud.status === 'saving' || state.dirty) label = 'Synchronisation…';
    if (state.cloud.status === 'saved' && !state.dirty) label = 'Sauvegardé dans Tresh';
    if (state.cloud.status === 'error') {
      label = 'Erreur de synchronisation';
      tone = 'is-error';
      title = state.cloud.message ?? label;
    }
    if (state.cloud.status === 'conflict') {
      label = 'Conflit de version';
      tone = 'is-error';
      title = state.cloud.message ?? label;
    }
  } else {
    label = state.dirty ? 'Sauvegarde locale…' : state.savedAt ? 'Sauvegardé localement' : 'Brouillon local';
  }

  return (
    <div className={`save-state ${tone}`} title={title}>
      <span className={`status-dot ${state.dirty ? 'is-dirty' : ''}`} aria-hidden="true" />
      {label}
    </div>
  );
}


function DesktopVaultState() {
  const { state } = useEditor();

  if (!state.vault.available) return null;

  const busy =
    state.vault.status === 'loading' ||
    state.vault.status === 'saving';
  const failed = state.vault.status === 'error';
  const label = failed
    ? 'Coffre local en erreur'
    : busy
      ? 'Coffre local…'
      : `Coffre chiffré${
          state.vault.backupCount > 0
            ? ` · ${state.vault.backupCount}`
            : ''
        }`;
  const title = failed
    ? state.vault.message ?? label
    : state.vault.path
      ? `${label}\n${state.vault.path}`
      : label;

  return (
    <div
      className={`desktop-vault-state ${busy ? 'is-busy' : ''} ${failed ? 'is-error' : ''}`}
      title={title}
    >
      {label}
    </div>
  );
}

function initials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'T';
}

export function Topbar() {
  const { state, dispatch, saveNow } = useEditor();
  const { mode, user, profile, passwordRecovery } = useAuth();
  const {
    status: siteStatus,
    sites,
    activeSite,
    selectSite,
  } = useSiteWorkspace();
  const [accountOpen, setAccountOpen] = useState(false);
  const [pageManagerOpen, setPageManagerOpen] = useState(false);
  const [siteManagerOpen, setSiteManagerOpen] = useState(false);
  const [siteSwitching, setSiteSwitching] = useState(false);
  const currentPage = getPage(state.document, state.pageId);
  const publicationConfigured =
    activeSite?.slug === 'atelier-expression';

  useEffect(() => {
    if (passwordRecovery) setAccountOpen(true);
  }, [passwordRecovery]);

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 's';

      if (!isSaveShortcut) return;

      event.preventDefault();

      if (state.cloud.status === 'saving') return;

      void saveNow().catch(() => {
        // L’état d’erreur est déjà conservé dans le store.
      });
    };

    window.addEventListener('keydown', handleSaveShortcut);

    return () => {
      window.removeEventListener('keydown', handleSaveShortcut);
    };
  }, [saveNow, state.cloud.status]);

  const saveButtonLabel =
    state.cloud.status === 'saving'
      ? 'Enregistrement…'
      : state.cloud.status === 'error' || state.cloud.status === 'conflict'
        ? 'Erreur'
        : state.dirty
          ? 'Enregistrer'
          : 'Enregistré';

  const saveButtonDisabled =
    state.cloud.status === 'saving' ||
    (
      !state.dirty &&
      state.cloud.status !== 'error' &&
      state.cloud.status !== 'conflict'
    );

  const accountLabel = profile.displayName || user?.email?.split('@')[0] || 'Compte';
  const accountInitials = useMemo(() => initials(accountLabel), [accountLabel]);


  const switchSite = async (siteId: string) => {
    if (
      siteId === activeSite?.id ||
      siteSwitching
    ) {
      return;
    }

    setSiteSwitching(true);

    try {
      if (state.dirty) {
        await saveNow();
      }

      selectSite(siteId);
    } catch (error: unknown) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Impossible de changer de site.',
      );
    } finally {
      setSiteSwitching(false);
    }
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar__left">
          <div className="editor-brand">
            <span className="editor-brand__dot" aria-hidden="true" />
            TRESH <strong>éditeur</strong>
          </div>
          <div className="site-switcher">
            <span className="site-switcher__label">Site</span>
            <select
              aria-label="Site actif"
              value={activeSite?.id ?? ''}
              disabled={
                siteSwitching ||
                siteStatus === 'loading' ||
                sites.length === 0
              }
              onChange={(event) => {
                void switchSite(event.currentTarget.value);
              }}
            >
              {sites.length === 0 && (
                <option value="">Aucun site</option>
              )}
              {sites.map((site) => (
                <option value={site.id} key={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              title="Créer, ouvrir et gérer les sites du compte"
              onClick={() => setSiteManagerOpen(true)}
            >
              Mes sites
            </button>
          </div>
          <div className="page-switcher">
            <span className="page-switcher__label">Page</span>
            <select
              aria-label="Page active"
              value={state.pageId}
              onChange={(event) =>
                dispatch({
                  type: 'page/select',
                  pageId: event.currentTarget.value,
                })
              }
            >
              {state.document.pages.map((page) => (
                <option value={page.id} key={page.id}>
                  {page.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              title="Créer et gérer les pages"
              onClick={() => setPageManagerOpen(true)}
            >
              Gérer
            </button>
          </div>
        </div>

        <div className="breakpoint-switch" aria-label="Format d’aperçu">
          {breakpoints.map(({ id, label }) => (
            <button
              type="button"
              className={state.breakpoint === id ? 'is-active' : ''}
              onClick={() => dispatch({ type: 'breakpoint/set', breakpoint: id })}
              key={id}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="topbar__right">
          <SaveState />
          <DesktopVaultState />
          {mode === 'signed-in' && (
            <button
              type="button"
              className="account-chip"
              title={`${accountLabel} — ouvrir les paramètres du compte`}
              onClick={() => setAccountOpen(true)}
            >
              <span className="account-avatar" aria-hidden="true">
                {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : accountInitials}
              </span>
              <span className="account-chip__label">{accountLabel}</span>
            </button>
          )}
          <button
            type="button"
            className="editor-button editor-button--ghost"
            disabled={state.past.length === 0}
            onClick={() => dispatch({ type: 'history/undo' })}
          >
            Annuler
          </button>
          <button
            type="button"
            className="editor-button editor-button--ghost"
            disabled={state.future.length === 0}
            onClick={() => dispatch({ type: 'history/redo' })}
          >
            Rétablir
          </button>
          <button
            type="button"
            className="editor-button editor-button--ghost"
            disabled={saveButtonDisabled}
            title="Enregistrer maintenant (Ctrl+S)"
            onClick={() => {
              void saveNow().catch(() => {
                // L’état d’erreur est déjà conservé dans le store.
              });
            }}
          >
            {saveButtonLabel}
          </button>
          <button
            type="button"
            className="editor-button editor-button--publish"
            disabled={!publicationConfigured}
            title={
              !publicationConfigured
                ? 'La publication publique de ce nouveau site sera configurée dans une prochaine étape.'
                : currentPage
                  ? `Publier le site incluant « ${currentPage.title} »`
                  : 'Publier le site'
            }
            onClick={() =>
              dispatch({
                type: 'publish-notice/open',
              })
            }
          >
            Publier
          </button>
        </div>
      </header>
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      <PageManagerModal
        open={pageManagerOpen}
        onClose={() => setPageManagerOpen(false)}
      />
      <SiteManagerModal
        open={siteManagerOpen}
        onClose={() => setSiteManagerOpen(false)}
      />
    </>
  );
}
