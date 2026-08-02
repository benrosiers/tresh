import { useEffect, useMemo, useState } from 'react';
import {
  createBlankPage,
  duplicatePageDocument,
  slugifyPageTitle,
} from '../model/pageTemplates';
import type { PageDocument } from '../model/siteDocument';
import { useEditor } from '../state/editorStore';

interface PageManagerModalProps {
  open: boolean;
  onClose: () => void;
}

interface PageDraft {
  title: string;
  slug: string;
  description: string;
}

function draftFromPage(page: PageDocument | undefined): PageDraft {
  return {
    title: page?.title ?? '',
    slug: page?.slug ?? '',
    description: page?.description ?? '',
  };
}

export function PageManagerModal({
  open,
  onClose,
}: PageManagerModalProps) {
  const { state, dispatch } = useEditor();
  const page = state.document.pages.find(
    (candidate) => candidate.id === state.pageId,
  );

  const [draft, setDraft] = useState<PageDraft>(() =>
    draftFromPage(page),
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(draftFromPage(page));
    setMessage(null);
  }, [page?.id]);

  const slugOwner = useMemo(
    () =>
      state.document.pages.find(
        (candidate) =>
          candidate.id !== page?.id &&
          candidate.slug === slugifyPageTitle(draft.slug),
      ),
    [draft.slug, page?.id, state.document.pages],
  );

  if (!open || !page) return null;

  const saveMetadata = () => {
    const title = draft.title.trim();
    const normalizedSlug =
      page.slug === 'home'
        ? 'home'
        : slugifyPageTitle(draft.slug);

    if (!title) {
      setMessage('Le titre de la page est requis.');
      return;
    }

    if (!normalizedSlug) {
      setMessage('Le slug doit contenir au moins une lettre ou un chiffre.');
      return;
    }

    if (slugOwner) {
      setMessage(`Le slug « ${normalizedSlug} » est déjà utilisé.`);
      return;
    }

    dispatch({
      type: 'page/update',
      pageId: page.id,
      patch: {
        title,
        slug: normalizedSlug,
        description: draft.description.trim(),
      },
    });

    setDraft((current) => ({
      ...current,
      title,
      slug: normalizedSlug,
      description: current.description.trim(),
    }));
    setMessage('Métadonnées enregistrées.');
  };

  const createPage = () => {
    const created = createBlankPage(state.document.pages);
    dispatch({ type: 'page/add', page: created });
  };

  const duplicatePage = () => {
    const duplicate = duplicatePageDocument(
      page,
      state.document.pages,
    );
    dispatch({ type: 'page/add', page: duplicate });
  };

  const deletePage = () => {
    if (page.slug === 'home' || state.document.pages.length <= 1) {
      return;
    }

    if (
      !window.confirm(
        `Supprimer la page « ${page.title} » et toutes ses sections?`,
      )
    ) {
      return;
    }

    dispatch({ type: 'page/remove', pageId: page.id });
  };

  const publicPath = page.slug === 'home' ? '/' : `/${page.slug}`;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="page-manager-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-manager-title"
      >
        <header className="page-manager-modal__header">
          <div>
            <span className="page-manager-modal__eyebrow">
              Site multipage
            </span>
            <h2 id="page-manager-title">Pages du site</h2>
          </div>
          <button
            type="button"
            className="page-manager-modal__close"
            aria-label="Fermer"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="page-manager-grid">
          <aside className="page-manager-list">
            <div className="page-manager-list__heading">
              <strong>{state.document.pages.length} pages</strong>
              <button type="button" onClick={createPage}>
                + Nouvelle
              </button>
            </div>

            <div className="page-manager-list__items">
              {state.document.pages.map((candidate) => (
                <button
                  type="button"
                  className={
                    candidate.id === page.id
                      ? 'page-manager-list__item is-active'
                      : 'page-manager-list__item'
                  }
                  onClick={() =>
                    dispatch({
                      type: 'page/select',
                      pageId: candidate.id,
                    })
                  }
                  key={candidate.id}
                >
                  <strong>{candidate.title}</strong>
                  <span>
                    {candidate.slug === 'home'
                      ? '/'
                      : `/${candidate.slug}`}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <div className="page-manager-editor">
            <div className="page-manager-path">
              URL publique : <code>{publicPath}</code>
            </div>

            <label className="inspector-field">
              <span>Titre de la page</span>
              <input
                value={draft.title}
                maxLength={120}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.currentTarget.value,
                  }))
                }
              />
            </label>

            <label className="inspector-field">
              <span>Slug / adresse</span>
              <input
                value={draft.slug}
                maxLength={80}
                disabled={page.slug === 'home'}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    slug: event.currentTarget.value,
                  }))
                }
              />
            </label>

            <label className="inspector-field">
              <span>Description SEO</span>
              <textarea
                rows={5}
                value={draft.description}
                maxLength={320}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.currentTarget.value,
                  }))
                }
              />
              <small>{draft.description.length} / 320</small>
            </label>

            {message && (
              <p
                className={
                  message.includes('requis') ||
                  message.includes('doit') ||
                  message.includes('déjà')
                    ? 'page-manager-message is-error'
                    : 'page-manager-message'
                }
                role="status"
              >
                {message}
              </p>
            )}

            <div className="page-manager-editor__actions">
              <button
                type="button"
                className="editor-button editor-button--ghost"
                onClick={duplicatePage}
              >
                Dupliquer
              </button>
              <button
                type="button"
                className="editor-button editor-button--danger"
                disabled={
                  page.slug === 'home' ||
                  state.document.pages.length <= 1
                }
                onClick={deletePage}
              >
                Supprimer
              </button>
              <button
                type="button"
                className="editor-button"
                onClick={saveMetadata}
              >
                Enregistrer la page
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
