import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { useAuth } from '../../auth';
import {
  clearLocalDraft,
  DraftConflictError,
  loadCloudDraft,
  loadLocalDraft,
  saveCloudDraft,
  saveLocalDraft,
} from '../../drafts/draftRepository';
import {
  addElementToSection,
  cloneDocument,
  findElement,
  getPage,
  moveSection,
  patchPlacement,
  removeElement,
  removeSection,
  updateElement,
  updateSection,
} from '../model/documentOps';
import { initialSiteDocument } from '../model/initialDocument';
import {
  type Breakpoint,
  type Placement,
  type SceneElement,
  type SiteDocument,
} from '../model/siteDocument';

export type EditorMode = 'simple' | 'advanced';
export type DraftSyncStatus = 'local' | 'loading' | 'saving' | 'saved' | 'error' | 'conflict';

interface CloudDraftState {
  status: DraftSyncStatus;
  pageId: string | null;
  lockVersion: number;
  message: string | null;
}

interface EditorState {
  document: SiteDocument;
  pageId: string;
  breakpoint: Breakpoint;
  mode: EditorMode;
  selectedId: string | null;
  activeSectionId: string;
  dirty: boolean;
  savedAt: number | null;
  past: SiteDocument[];
  future: SiteDocument[];
  interactionBase: SiteDocument | null;
  publishNoticeOpen: boolean;
  cloud: CloudDraftState;
}

export type EditorAction =
  | { type: 'breakpoint/set'; breakpoint: Breakpoint }
  | { type: 'mode/set'; mode: EditorMode }
  | { type: 'element/select'; elementId: string | null; sectionId?: string }
  | { type: 'section/activate'; sectionId: string }
  | { type: 'element/add'; element: SceneElement }
  | { type: 'element/remove'; elementId: string }
  | { type: 'element/update'; elementId: string; updater: (element: SceneElement) => SceneElement }
  | { type: 'element/update-live'; elementId: string; updater: (element: SceneElement) => SceneElement }
  | { type: 'placement/patch'; elementId: string; patch: Partial<Placement>; live?: boolean }
  | { type: 'section/toggle'; sectionId: string }
  | { type: 'section/move'; sectionId: string; direction: -1 | 1 }
  | { type: 'section/add'; sectionId: string; label: string }
  | { type: 'section/remove'; sectionId: string }
  | { type: 'interaction/start' }
  | { type: 'interaction/end' }
  | { type: 'history/undo' }
  | { type: 'history/redo' }
  | { type: 'draft/cloud-loading' }
  | { type: 'draft/cloud-ready'; pageId: string; lockVersion: number; markDirty: boolean }
  | { type: 'draft/hydrate'; document: SiteDocument; pageId: string; lockVersion: number; savedAt: number }
  | { type: 'draft/saving' }
  | { type: 'draft/local-cached'; savedAt: number }
  | { type: 'draft/saved'; savedAt: number; lockVersion: number | null; document: SiteDocument }
  | { type: 'draft/error'; message: string }
  | { type: 'draft/conflict'; message: string }
  | { type: 'draft/reset' }
  | { type: 'publish-notice/open' }
  | { type: 'publish-notice/close' };

interface SaveResult {
  document: SiteDocument;
  lockVersion: number | null;
}

interface EditorContextValue {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  saveNow: () => Promise<number | null>;
}

const EditorContext = createContext<EditorContextValue | null>(null);

function initialState(): EditorState {
  const local = loadLocalDraft();
  const document = local?.document ?? cloneDocument(initialSiteDocument);
  const page = document.pages[0];
  const activeSectionId = page?.sections[0]?.id ?? 'hero';
  return {
    document,
    pageId: page?.id ?? '',
    breakpoint: 'desktop',
    mode: 'simple',
    selectedId: null,
    activeSectionId,
    dirty: false,
    savedAt: local?.savedAt ?? null,
    past: [],
    future: [],
    interactionBase: null,
    publishNoticeOpen: false,
    cloud: {
      status: 'local',
      pageId: null,
      lockVersion: 0,
      message: null,
    },
  };
}

function committed(state: EditorState, document: SiteDocument): EditorState {
  return {
    ...state,
    document,
    dirty: true,
    past: [...state.past.slice(-49), state.document],
    future: [],
  };
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'breakpoint/set':
      return { ...state, breakpoint: action.breakpoint, selectedId: null };
    case 'mode/set':
      return { ...state, mode: action.mode };
    case 'element/select':
      return {
        ...state,
        selectedId: action.elementId,
        activeSectionId: action.sectionId ?? state.activeSectionId,
      };
    case 'section/activate':
      return { ...state, activeSectionId: action.sectionId, selectedId: null };
    case 'element/add':
      return {
        ...committed(state, addElementToSection(state.document, state.activeSectionId, action.element)),
        selectedId: action.element.id,
      };
    case 'element/remove':
      return {
        ...committed(state, removeElement(state.document, action.elementId)),
        selectedId: null,
      };
    case 'element/update':
      return committed(state, updateElement(state.document, action.elementId, action.updater));
    case 'element/update-live':
      return {
        ...state,
        document: updateElement(state.document, action.elementId, action.updater),
        dirty: true,
      };
    case 'placement/patch': {
      const updater = (element: SceneElement): SceneElement => ({
        ...element,
        placement: patchPlacement(element.placement, state.breakpoint, action.patch),
      });
      if (action.live) {
        return {
          ...state,
          document: updateElement(state.document, action.elementId, updater),
          dirty: true,
        };
      }
      return committed(state, updateElement(state.document, action.elementId, updater));
    }
    case 'section/toggle':
      return committed(
        state,
        updateSection(state.document, action.sectionId, (section) => ({
          ...section,
          visible: !section.visible,
        })),
      );
    case 'section/move':
      return committed(
        state,
        moveSection(state.document, state.pageId, action.sectionId, action.direction),
      );
    case 'section/add': {
      const next = cloneDocument(state.document);
      const page = next.pages.find((candidate) => candidate.id === state.pageId);
      if (!page) return state;
      page.sections.push({
        id: action.sectionId,
        type: 'FreeformSection',
        label: action.label,
        visible: true,
        height: { desktop: 280, tablet: 320, mobile: 380 },
        props: {},
        scene: [],
      });
      return { ...committed(state, next), activeSectionId: action.sectionId, selectedId: null };
    }
    case 'section/remove': {
      const page = getPage(state.document, state.pageId);
      if (!page || page.sections.length <= 1) return state;
      const index = page.sections.findIndex((section) => section.id === action.sectionId);
      if (index < 0) return state;
      const adjacentSectionId = page.sections[index + 1]?.id ?? page.sections[index - 1]?.id;
      const nextActive = state.activeSectionId === action.sectionId
        ? adjacentSectionId
        : state.activeSectionId;
      if (!nextActive) return state;
      return {
        ...committed(state, removeSection(state.document, state.pageId, action.sectionId)),
        activeSectionId: nextActive,
        selectedId: null,
      };
    }
    case 'interaction/start':
      return state.interactionBase
        ? state
        : { ...state, interactionBase: cloneDocument(state.document) };
    case 'interaction/end':
      if (!state.interactionBase) return state;
      return {
        ...state,
        past: [...state.past.slice(-49), state.interactionBase],
        future: [],
        interactionBase: null,
        dirty: true,
      };
    case 'history/undo': {
      const previous = state.past.at(-1);
      if (!previous) return state;
      const previousPage = getPage(previous, state.pageId);
      const activeSectionId = previousPage?.sections.some((section) => section.id === state.activeSectionId)
        ? state.activeSectionId
        : previousPage?.sections[0]?.id ?? state.activeSectionId;
      return {
        ...state,
        document: previous,
        past: state.past.slice(0, -1),
        future: [state.document, ...state.future].slice(0, 50),
        dirty: true,
        selectedId: findElement(previous, state.selectedId ?? '') ? state.selectedId : null,
        activeSectionId,
      };
    }
    case 'history/redo': {
      const next = state.future[0];
      if (!next) return state;
      const nextPage = getPage(next, state.pageId);
      const activeSectionId = nextPage?.sections.some((section) => section.id === state.activeSectionId)
        ? state.activeSectionId
        : nextPage?.sections[0]?.id ?? state.activeSectionId;
      return {
        ...state,
        document: next,
        past: [...state.past, state.document].slice(-50),
        future: state.future.slice(1),
        dirty: true,
        selectedId: findElement(next, state.selectedId ?? '') ? state.selectedId : null,
        activeSectionId,
      };
    }
    case 'draft/cloud-loading':
      return { ...state, cloud: { ...state.cloud, status: 'loading', message: null } };
    case 'draft/cloud-ready':
      return {
        ...state,
        dirty: state.dirty || action.markDirty,
        cloud: {
          status: action.markDirty ? 'saving' : 'saved',
          pageId: action.pageId,
          lockVersion: action.lockVersion,
          message: null,
        },
      };
    case 'draft/hydrate': {
      const page = action.document.pages[0];
      return {
        ...state,
        document: action.document,
        pageId: page?.id ?? state.pageId,
        activeSectionId: page?.sections[0]?.id ?? state.activeSectionId,
        selectedId: null,
        dirty: false,
        savedAt: action.savedAt,
        past: [],
        future: [],
        interactionBase: null,
        cloud: {
          status: 'saved',
          pageId: action.pageId,
          lockVersion: action.lockVersion,
          message: null,
        },
      };
    }
    case 'draft/saving':
      return { ...state, cloud: { ...state.cloud, status: 'saving', message: null } };
    case 'draft/local-cached':
      return { ...state, savedAt: action.savedAt };
    case 'draft/saved':
      return {
        ...state,
        dirty: state.document !== action.document,
        savedAt: action.savedAt,
        cloud: action.lockVersion === null
          ? { ...state.cloud, status: 'local', message: null }
          : { ...state.cloud, status: 'saved', lockVersion: action.lockVersion, message: null },
      };
    case 'draft/error':
      return { ...state, dirty: true, cloud: { ...state.cloud, status: 'error', message: action.message } };
    case 'draft/conflict':
      return { ...state, dirty: true, cloud: { ...state.cloud, status: 'conflict', message: action.message } };
    case 'draft/reset': {
      clearLocalDraft();
      const document = cloneDocument(initialSiteDocument);
      return {
        ...state,
        document,
        selectedId: null,
        activeSectionId: document.pages[0]?.sections[0]?.id ?? 'hero',
        past: [...state.past.slice(-49), state.document],
        future: [],
        interactionBase: null,
        dirty: true,
      };
    }
    case 'publish-notice/open':
      return { ...state, publishNoticeOpen: true };
    case 'publish-notice/close':
      return { ...state, publishNoticeOpen: false };
    default:
      return state;
  }
}

export function EditorProvider({ children }: PropsWithChildren) {
  const { mode: authMode, user } = useAuth();
  const [state, dispatch] = useReducer(editorReducer, undefined, initialState);
  const hydrationRequest = useRef<{
    userId: string;
    promise: ReturnType<typeof loadCloudDraft>;
    applied: boolean;
  } | null>(null);

  const stateRef = useRef(state);
  const saveInFlightRef = useRef<Promise<SaveResult> | null>(null);
  const cloudLockVersionRef = useRef(state.cloud.lockVersion);

  stateRef.current = state;

  if (!saveInFlightRef.current) {
    cloudLockVersionRef.current = state.cloud.lockVersion;
  }

  const saveOnce = useCallback((): Promise<SaveResult> => {
    if (saveInFlightRef.current) {
      return saveInFlightRef.current;
    }

    const snapshot = stateRef.current;
    const document = snapshot.document;
    const savedAt = Date.now();

    const task = (async (): Promise<SaveResult> => {
      saveLocalDraft({
        document,
        savedAt,
      });

      if (authMode !== 'signed-in') {
        dispatch({
          type: 'draft/saved',
          savedAt,
          lockVersion: null,
          document,
        });

        return {
          document,
          lockVersion: null,
        };
      }

      const pageId = snapshot.cloud.pageId;

      if (!pageId) {
        dispatch({
          type: 'draft/local-cached',
          savedAt,
        });

        throw new Error(
          'La page Tresh n’est pas prête pour la synchronisation.',
        );
      }

      dispatch({ type: 'draft/saving' });

      try {
        const saved = await saveCloudDraft(
          pageId,
          document,
          cloudLockVersionRef.current,
        );

        cloudLockVersionRef.current = saved.lockVersion;

        dispatch({
          type: 'draft/saved',
          savedAt: saved.updatedAt,
          lockVersion: saved.lockVersion,
          document,
        });

        return {
          document,
          lockVersion: saved.lockVersion,
        };
      } catch (error: unknown) {
        if (error instanceof DraftConflictError) {
          dispatch({
            type: 'draft/conflict',
            message: error.message,
          });
        } else {
          const message =
            error instanceof Error
              ? error.message
              : 'Impossible de synchroniser le brouillon.';

          dispatch({
            type: 'draft/error',
            message,
          });
        }

        throw error;
      }
    })();

    const trackedTask = task.finally(() => {
      saveInFlightRef.current = null;
    });

    saveInFlightRef.current = trackedTask;

    return trackedTask;
  }, [authMode]);

  const saveNow = useCallback(async (): Promise<number | null> => {
    let saved = await saveOnce();

    while (stateRef.current.document !== saved.document) {
      saved = await saveOnce();
    }

    return saved.lockVersion;
  }, [saveOnce]);

  useEffect(() => {
    if (authMode !== 'signed-in' || !user) return;
    if (!hydrationRequest.current || hydrationRequest.current.userId !== user.id) {
      hydrationRequest.current = { userId: user.id, promise: loadCloudDraft(), applied: false };
    }
    if (hydrationRequest.current.applied) return;
    let cancelled = false;

    dispatch({ type: 'draft/cloud-loading' });
    void hydrationRequest.current.promise
      .then((cloudDraft) => {
        if (cancelled) return;
        if (hydrationRequest.current?.userId === user.id) {
          hydrationRequest.current.applied = true;
        }
        const local = loadLocalDraft();
        const localIsNewer = Boolean(
          local && cloudDraft.updatedAt !== null && local.savedAt > cloudDraft.updatedAt,
        );

        if (!cloudDraft.document) {
          dispatch({
            type: 'draft/cloud-ready',
            pageId: cloudDraft.pageId,
            lockVersion: cloudDraft.lockVersion,
            markDirty: true,
          });
          return;
        }

        if (localIsNewer) {
          dispatch({
            type: 'draft/cloud-ready',
            pageId: cloudDraft.pageId,
            lockVersion: cloudDraft.lockVersion,
            markDirty: true,
          });
          return;
        }

        const savedAt = cloudDraft.updatedAt ?? Date.now();
        saveLocalDraft({ document: cloudDraft.document, savedAt });
        dispatch({
          type: 'draft/hydrate',
          document: cloudDraft.document,
          pageId: cloudDraft.pageId,
          lockVersion: cloudDraft.lockVersion,
          savedAt,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        hydrationRequest.current = null;
        const message = error instanceof Error ? error.message : 'Impossible de charger le brouillon Tresh.';
        dispatch({ type: 'draft/error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [authMode, user]);

  useEffect(() => {
    if (!state.dirty || state.cloud.status === 'saving') return;

    const handle = window.setTimeout(() => {
      void saveNow().catch(() => {
        // L’état d’erreur est déjà enregistré dans le store.
      });
    }, 5000);

    return () => window.clearTimeout(handle);
  }, [saveNow, state.cloud.status, state.dirty, state.document]);

  const value = useMemo(
    () => ({ state, dispatch, saveNow }),
    [state, saveNow],
  );
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) throw new Error('useEditor must be used inside EditorProvider');
  return context;
}

export function createElementForTool(
  tool: 'heading' | 'text' | 'button' | 'image' | 'paint' | 'shape' | 'section',
  sectionId: string,
): SceneElement | null {
  if (tool === 'section') return null;
  const id = `${tool}-${crypto.randomUUID().slice(0, 8)}`;

  if (tool === 'shape') {
    return {
      id,
      sectionId,
      type: 'shape',
      shapeKind: 'rectangle',
      fillColor: '#E98B5F',
      strokeColor: '#2B2620',
      strokeWidth: 0,
      cornerRadius: 12,
      placement: {
        desktop: {
          xPercent: 50,
          yPercent: 50,
          widthPercent: 24,
          heightPercent: 18,
          rotationDegrees: 0,
          zIndex: 5,
          opacity: 1,
          parallaxDepth: 0,
        },
      },
      visible: true,
      locked: false,
    };
  }

  const placement = {
    desktop: {
      xPercent: 46,
      yPercent: 46,
      widthPercent: tool === 'heading' ? 44 : tool === 'paint' ? 16 : 34,
      rotationDegrees: 0,
      zIndex: 5,
      opacity: 1,
      fontSize: tool === 'heading' ? 34 : 17,
      parallaxDepth: tool === 'paint' ? 0.15 : 0,
    },
  };

  if (tool === 'heading' || tool === 'text') {
    return {
      id,
      sectionId,
      type: 'text',
      text: { 'fr-CA': tool === 'heading' ? 'Nouveau titre' : 'Nouveau texte' },
      variant: tool === 'heading' ? 'heading' : 'body',
      placement,
      visible: true,
      locked: false,
    };
  }

  if (tool === 'paint') {
    return {
      id,
      sectionId,
      type: 'paint',
      assetKey: 'coral',
      decorative: true,
      placement,
      visible: true,
      locked: false,
    };
  }

  if (tool === 'button') {
    return {
      id,
      sectionId,
      type: 'button',
      label: { 'fr-CA': 'Reserver ma place' },
      href: '/reserver',
      variant: 'primary',
      placement,
      visible: true,
      locked: false,
    };
  }

  return {
    id,
    sectionId,
    type: 'image',
    source: { kind: 'placeholder', label: 'Nouvelle image' },
    altText: { 'fr-CA': 'Image a remplacer' },
    cornerRadius: 24,
    placement,
    visible: true,
    locked: false,
  };
}