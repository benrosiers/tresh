import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSiteWorkspace } from '../../sites';
import type { PageDocument, SiteDocument } from '../model/siteDocument';
import { useEditor } from '../state/editorStore';

interface PendingPreviewNavigation {
  pageId: string;
  hash: string;
}

interface LocalPreviewResponse {
  ok: boolean;
  url: string;
}

const LOCAL_PREVIEW_ENDPOINT =
  'http://127.0.0.1:4322/api/preview';

function removeEditorOnlyMarkup(root: HTMLElement) {
  root
    .querySelectorAll(
      '.site-section__tag, .selection-hud, .moveable-control-box, .frame-label',
    )
    .forEach((node) => node.remove());

  root.querySelectorAll<HTMLElement>('.canvas-element').forEach((element) => {
    element.classList.remove('is-selected', 'is-locked');
  });
}

function copyDocumentStyles(targetDocument: Document) {
  const base = targetDocument.createElement('base');
  base.href = window.location.href;
  targetDocument.head.append(base);

  window.document
    .querySelectorAll('link[rel="stylesheet"], style')
    .forEach((node) => {
      targetDocument.head.append(node.cloneNode(true));
    });

  const previewStyle = targetDocument.createElement('style');
  previewStyle.textContent = `
    html,
    body {
      min-height: 100%;
      margin: 0;
      background: #14161a;
    }

    body {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 28px;
      overflow: auto;
    }

    #tresh-preview-root {
      flex: none;
    }

    #tresh-preview-root > .site-frame {
      transform: none !important;
      transform-origin: top left !important;
    }

    .site-section__tag,
    .selection-hud,
    .moveable-control-box,
    .frame-label {
      display: none !important;
    }

    .canvas-element {
      cursor: default !important;
      outline: none !important;
    }
  `;
  targetDocument.head.append(previewStyle);
}

function previewSlugPath(page: PageDocument): string {
  return page.slug === 'home' ? '/' : `/${page.slug}`;
}

function pageForHref(
  document: SiteDocument,
  href: string,
): { page: PageDocument; hash: string } | null {
  if (!href.startsWith('/')) return null;

  const parsed = new URL(href, 'https://tresh-preview.invalid');
  const slug = parsed.pathname.replace(/^\/+|\/+$/g, '') || 'home';
  const page = document.pages.find((candidate) => candidate.slug === slug);

  return page ? { page, hash: parsed.hash } : null;
}

function cloneCurrentFrame(): HTMLElement | null {
  const source = window.document.querySelector<HTMLElement>('.site-frame');
  if (!source) return null;

  const clone = source.cloneNode(true) as HTMLElement;
  removeEditorOnlyMarkup(clone);

  clone.style.transform = 'none';
  clone.style.transformOrigin = 'top left';
  clone.style.width = source.style.width || `${source.offsetWidth}px`;
  clone.style.minHeight =
    source.style.minHeight || `${source.scrollHeight}px`;

  return clone;
}

function renderCurrentCanvasInPreview(
  previewWindow: Window,
  page: PageDocument,
  siteTitle: string,
  hash = '',
): boolean {
  const clone = cloneCurrentFrame();
  if (!clone) return false;

  const previewDocument = previewWindow.document;
  const root = previewDocument.getElementById('tresh-preview-root');
  if (!root) return false;

  root.replaceChildren(clone);
  previewDocument.title = `Aperçu — ${page.title} — ${siteTitle}`;

  const historyHash = hash || '';
  previewWindow.history.replaceState(
    null,
    '',
    `#${previewSlugPath(page)}${historyHash}`,
  );

  window.requestAnimationFrame(() => {
    if (hash) {
      previewDocument.getElementById(hash.slice(1))?.scrollIntoView();
    } else {
      previewWindow.scrollTo({ top: 0, left: 0 });
    }
  });

  return true;
}

function initializePreviewDocument(
  previewWindow: Window,
  faviconUrl?: string,
) {
  const previewDocument = previewWindow.document;
  previewDocument.open();
  previewDocument.write(
    '<!doctype html><html lang="fr-CA"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><main id="tresh-preview-root"></main></body></html>',
  );
  previewDocument.close();

  copyDocumentStyles(previewDocument);

  if (faviconUrl) {
    const favicon = previewDocument.createElement('link');
    favicon.rel = 'icon';
    favicon.href = faviconUrl;
    previewDocument.head.append(favicon);
  }
}

async function openFullSitePreview(
  document: SiteDocument,
  page: PageDocument,
) {
  const previewWindow = window.open('', '_blank');

  if (!previewWindow) {
    window.alert(
      "Le navigateur a bloqué l'onglet de la copie locale. Autorise les fenêtres contextuelles pour Tresh.",
    );
    return;
  }

  const loadingDocument = previewWindow.document;
  loadingDocument.open();
  loadingDocument.write(
    '<!doctype html><html lang="fr-CA"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Copie locale Tresh</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#14161a;color:#f7f2ea;font-family:system-ui,sans-serif"><main style="max-width:620px;padding:40px;text-align:center"><h1 style="font-size:24px">Préparation de la copie locale…</h1><p style="opacity:.75">Tresh transmet le brouillon actuel au serveur Astro local.</p></main></body></html>',
  );
  loadingDocument.close();

  try {
    const response = await fetch(LOCAL_PREVIEW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document,
        pageSlug: page.slug,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const result = (await response.json()) as LocalPreviewResponse;

    if (!result.ok || !result.url) {
      throw new Error('Le serveur local a retourné une réponse invalide.');
    }

    previewWindow.location.replace(result.url);
    previewWindow.focus();
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Impossible de joindre la copie Astro locale.';

    const errorDocument = previewWindow.document;
    errorDocument.open();
    errorDocument.write(`<!doctype html><html lang="fr-CA"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Copie locale indisponible</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#14161a;color:#f7f2ea;font-family:system-ui,sans-serif"><main style="max-width:720px;padding:40px"><p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#e98b5f">Copie locale seulement</p><h1 style="font-size:28px">Le serveur Astro local n'est pas démarré.</h1><p style="line-height:1.6;opacity:.8">Dans PowerShell, lance cette commande puis reclique sur <strong>Site complet ↗</strong> :</p><pre style="overflow:auto;padding:18px;border-radius:10px;background:#22252b;color:#fff">cd E:\\Omni\\atelierexpression\nnpm run preview:tresh</pre><p style="font-size:13px;opacity:.6">Détail : ${message.replace(/[<>&]/g, '')}</p></main></body></html>`);
    errorDocument.close();
  }
}

export function PreviewButtonPortal() {
  const { state, dispatch } = useEditor();
  const { activeSite } = useSiteWorkspace();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const previewWindowRef = useRef<Window | null>(null);
  const pendingNavigationRef = useRef<PendingPreviewNavigation | null>(null);
  const stateRef = useRef(state);

  stateRef.current = state;

  useEffect(() => {
    const actions = window.document.querySelector<HTMLElement>('.topbar__right');

    if (!actions) return;

    const portalHost = window.document.createElement('span');
    portalHost.dataset.previewButtonHost = 'true';
    portalHost.style.display = 'contents';

    const publishButton = actions.querySelector('.editor-button--publish');
    actions.insertBefore(portalHost, publishButton);
    setHost(portalHost);

    return () => {
      portalHost.remove();
    };
  }, []);

  useEffect(() => {
    const pending = pendingNavigationRef.current;
    const previewWindow = previewWindowRef.current;

    if (
      !pending ||
      !previewWindow ||
      previewWindow.closed ||
      pending.pageId !== state.pageId
    ) {
      return;
    }

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const nextPage = state.document.pages.find(
          (candidate) => candidate.id === pending.pageId,
        );

        if (
          nextPage &&
          renderCurrentCanvasInPreview(
            previewWindow,
            nextPage,
            state.document.branding.title,
            pending.hash,
          )
        ) {
          pendingNavigationRef.current = null;
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [state.document, state.pageId]);

  const openPreview = () => {
    const currentPage = state.document.pages.find(
      (candidate) => candidate.id === state.pageId,
    );

    if (!currentPage) {
      window.alert("La page active n'existe plus.");
      return;
    }

    const previewWindow = window.open('', '_blank');

    if (!previewWindow) {
      window.alert(
        "Le navigateur a bloqué l'onglet d'aperçu. Autorise les fenêtres contextuelles pour Tresh.",
      );
      return;
    }

    initializePreviewDocument(
      previewWindow,
      state.document.branding.faviconUrl,
    );

    if (
      !renderCurrentCanvasInPreview(
        previewWindow,
        currentPage,
        state.document.branding.title,
      )
    ) {
      previewWindow.close();
      window.alert("Le canevas n'est pas prêt pour l'aperçu.");
      return;
    }

    previewWindow.document.addEventListener('click', (event) => {
      const target = event.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;

      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href')?.trim();
      if (!href) return;

      if (href.startsWith('#')) {
        event.preventDefault();
        previewWindow.document
          .getElementById(href.slice(1))
          ?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      const internal = pageForHref(stateRef.current.document, href);

      if (!internal) {
        if (href.startsWith('/')) {
          event.preventDefault();
          previewWindow.location.assign(
            new URL(href, 'https://atelierexpression.ca').href,
          );
        }
        return;
      }

      event.preventDefault();
      pendingNavigationRef.current = {
        pageId: internal.page.id,
        hash: internal.hash,
      };

      if (stateRef.current.pageId === internal.page.id) {
        renderCurrentCanvasInPreview(
          previewWindow,
          internal.page,
          stateRef.current.document.branding.title,
          internal.hash,
        );
        pendingNavigationRef.current = null;
        return;
      }

      dispatch({
        type: 'page/select',
        pageId: internal.page.id,
      });
    });

    previewWindowRef.current = previewWindow;
    previewWindow.focus();
  };

  if (!host) return null;

  const currentPage = state.document.pages.find(
    (candidate) => candidate.id === state.pageId,
  );
  const fullSiteAvailable =
    activeSite?.slug === 'atelier-expression';

  return createPortal(
    <>
      <button
        type="button"
        className="editor-button editor-button--ghost"
        title="Ouvrir un aperçu léger de la page active"
        onClick={openPreview}
      >
        Aperçu ↗
      </button>
      <button
        type="button"
        className="editor-button editor-button--ghost"
        disabled={!currentPage || !fullSiteAvailable}
        title={
          fullSiteAvailable
            ? 'Ouvrir la copie Astro locale complète, sans publier atelierexpression.ca'
            : 'La copie Astro complète est actuellement configurée seulement pour Atelier Expression.'
        }
        onClick={() => {
          if (currentPage) {
            void openFullSitePreview(state.document, currentPage);
          }
        }}
      >
        Site complet ↗
      </button>
    </>,
    host,
  );
}
