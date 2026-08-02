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
  isDesktopVaultAvailable,
  loadDesktopVault,
  saveDesktopVault,
  type DesktopVaultStatus,
} from '../../desktop';
import {
  DraftConflictError,
  loadCloudDraft,
  loadLocalDraft,
  saveCloudDraft,
  saveLocalDraft,
  type DraftScope,
} from '../../drafts/draftRepository';
import {
  createBlankSiteDocument,
  useSiteWorkspace,
} from '../../sites';
import {
  addElementToSection,
  addPage,
  cloneDocument,
  findElement,
  getPage,
  moveSection,
  patchPlacement,
  removeElement,
  removePage,
  removeSection,
  updateElement,
  updatePage,
  updateSection,
} from '../model/documentOps';
import {
  duplicateElementInDocument,
  duplicateSectionInDocument,
} from '../model/duplication';
import { initialSiteDocument } from '../model/initialDocument';
import {
  applySelectionPlacementPatches,
  duplicateSelectionInDocument,
  removeSelectionFromDocument,
  type SelectionPlacementPatches,
} from '../model/selectionOps';
import { ensureCanonicalPages } from '../model/pageTemplates';
import {
  shouldPreserveEditsDuringHydration,
} from '../model/draftHydration';
import {
  ensureSiteChrome,
  type Breakpoint,
  type PageDocument,
  type Placement,
  type SceneElement,
  type SiteDocument,
} from '../model/siteDocument';

export type EditorMode = 'simple' | 'advanced';
export type DraftSyncStatus = 'local' | 'loading' | 'saving' | 'saved' | 'error' | 'conflict';
export type VaultSyncStatus = 'web' | 'loading' | 'saving' | 'saved' | 'error';

interface CloudDraftState {
  status: DraftSyncStatus;
  pageId: string | null;
  lockVersion: number;
  message: string | null;
}

interface DesktopVaultState {
  available: boolean;
  status: VaultSyncStatus;
  path: string;
  savedAt: number | null;
  backupCount: number;
  message: string | null;
}

interface EditorState {
  document: SiteDocument;
  pageId: string;
  breakpoint: Breakpoint;
  mode: EditorMode;
  selectedId: string | null;
  selectedIds: string[];
  activeSectionId: string;
  dirty: boolean;
  savedAt: number | null;
  past: SiteDocument[];
  future: SiteDocument[];
  interactionBase: SiteDocument | null;
  publishNoticeOpen: boolean;
  cloud: CloudDraftState;
  vault: DesktopVaultState;
}

export type EditorAction =
  | { type: 'breakpoint/set'; breakpoint: Breakpoint }
  | { type: 'mode/set'; mode: EditorMode }
  | { type: 'page/select'; pageId: string }
  | { type: 'page/add'; page: PageDocument }
  | {
      type: 'page/update';
      pageId: string;
      patch: Partial<
        Pick<PageDocument, 'slug' | 'title' | 'description'>
      >;
    }
  | { type: 'page/remove'; pageId: string }
  | { type: 'site/update'; updater: (document: SiteDocument) => SiteDocument }
  | {
      type: 'element/select';
      elementId: string | null;
      sectionId?: string;
      additive?: boolean;
    }
  | { type: 'selection/clear' }
  | { type: 'selection/duplicate' }
  | { type: 'selection/remove' }
  | {
      type: 'selection/patches';
      patches: SelectionPlacementPatches;
      live?: boolean;
    }
  | { type: 'section/activate'; sectionId: string }
  | { type: 'element/add'; element: SceneElement }
  | { type: 'element/duplicate'; elementId: string }
  | { type: 'element/remove'; elementId: string }
  | { type: 'element/update'; elementId: string; updater: (element: SceneElement) => SceneElement }
  | { type: 'element/update-live'; elementId: string; updater: (element: SceneElement) => SceneElement }
  | { type: 'placement/patch'; elementId: string; patch: Partial<Placement>; live?: boolean }
  | { type: 'section/toggle'; sectionId: string }
  | { type: 'section/move'; sectionId: string; direction: -1 | 1 }
  | { type: 'section/add'; sectionId: string; label: string }
  | { type: 'section/duplicate'; sectionId: string }
  | { type: 'section/remove'; sectionId: string }
  | { type: 'interaction/start' }
  | { type: 'interaction/end' }
  | { type: 'history/undo' }
  | { type: 'history/redo' }
  | { type: 'draft/cloud-loading' }
  | { type: 'draft/cloud-ready'; pageId: string; lockVersion: number; markDirty: boolean }
  | {
      type: 'draft/hydrate';
      document: SiteDocument;
      pageId: string | null;
      lockVersion: number;
      savedAt: number;
      markDirty: boolean;
    }
  | { type: 'draft/saving' }
  | { type: 'draft/local-cached'; savedAt: number }
  | { type: 'draft/saved'; savedAt: number; lockVersion: number | null; document: SiteDocument }
  | { type: 'draft/error'; message: string }
  | { type: 'draft/conflict'; message: string }
  | { type: 'vault/loading' }
  | { type: 'vault/saving' }
  | { type: 'vault/ready'; status: DesktopVaultStatus }
  | { type: 'vault/error'; message: string }
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

function normalizeLoadedDocument(
  document: SiteDocument,
): SiteDocument {
  const normalized = ensureSiteChrome(document);

  return normalized.siteKit === 'atelierexpression'
    ? ensureCanonicalPages(normalized)
    : normalized;
}

function resolvePageState(
  document: SiteDocument,
  preferredPageId: string,
  preferredSectionId: string,
) {
  const page =
    getPage(document, preferredPageId) ??
    document.pages[0];

  const activeSectionId =
    page?.sections.some(
      (section) => section.id === preferredSectionId,
    )
      ? preferredSectionId
      : page?.sections[0]?.id ?? preferredSectionId;

  return {
    pageId: page?.id ?? '',
    activeSectionId,
  };
}

export function initialState(): EditorState {
  const document = normalizeLoadedDocument(
    cloneDocument(initialSiteDocument),
  );
  const page = document.pages[0];
  const activeSectionId =
    page?.sections[0]?.id ?? 'hero';

  return {
    document,
    pageId: page?.id ?? '',
    breakpoint: 'desktop',
    mode: 'simple',
    selectedId: null,
    selectedIds: [],
    activeSectionId,
    dirty: false,
    savedAt: null,
    past: [],
    future: [],
    interactionBase: null,
    publishNoticeOpen: false,
    cloud: {
      status: 'loading',
      pageId: null,
      lockVersion: 0,
      message: null,
    },
    vault: {
      available: isDesktopVaultAvailable(),
      status: isDesktopVaultAvailable() ? 'loading' : 'web',
      path: '',
      savedAt: null,
      backupCount: 0,
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

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'breakpoint/set':
      return {
        ...state,
        breakpoint: action.breakpoint,
        selectedId: null,
        selectedIds: [],
      };
    case 'mode/set':
      return { ...state, mode: action.mode };
    case 'page/select': {
      const page = getPage(state.document, action.pageId);
      if (!page) return state;

      return {
        ...state,
        pageId: page.id,
        activeSectionId:
          page.sections[0]?.id ?? state.activeSectionId,
        selectedId: null,
        selectedIds: [],
      };
    }
    case 'page/add': {
      if (
        state.document.pages.some(
          (page) =>
            page.id === action.page.id ||
            page.slug === action.page.slug,
        )
      ) {
        return state;
      }

      const document = addPage(state.document, action.page);
      return {
        ...committed(state, document),
        pageId: action.page.id,
        activeSectionId:
          action.page.sections[0]?.id ??
          state.activeSectionId,
        selectedId: null,
        selectedIds: [],
      };
    }
    case 'page/update': {
      const duplicateSlug = state.document.pages.some(
        (page) =>
          page.id !== action.pageId &&
          page.slug === action.patch.slug,
      );

      if (duplicateSlug) return state;

      return committed(
        state,
        updatePage(
          state.document,
          action.pageId,
          action.patch,
        ),
      );
    }
    case 'page/remove': {
      const page = getPage(state.document, action.pageId);
      if (
        !page ||
        page.slug === 'home' ||
        state.document.pages.length <= 1
      ) {
        return state;
      }

      const index = state.document.pages.findIndex(
        (candidate) => candidate.id === action.pageId,
      );
      const fallback =
        state.document.pages[index + 1] ??
        state.document.pages[index - 1];

      if (!fallback) return state;

      return {
        ...committed(
          state,
          removePage(state.document, action.pageId),
        ),
        pageId: fallback.id,
        activeSectionId:
          fallback.sections[0]?.id ??
          state.activeSectionId,
        selectedId: null,
        selectedIds: [],
      };
    }
    case 'site/update':
      return committed(
        state,
        ensureSiteChrome(action.updater(state.document)),
      );
    case 'element/select': {
      if (!action.elementId) {
        return {
          ...state,
          selectedId: null,
          selectedIds: [],
        };
      }

      const sectionId =
        action.sectionId ?? state.activeSectionId;
      const sameSection =
        sectionId === state.activeSectionId;

      if (!action.additive || !sameSection) {
        return {
          ...state,
          selectedId: action.elementId,
          selectedIds: [action.elementId],
          activeSectionId: sectionId,
        };
      }

      if (state.selectedIds.includes(action.elementId)) {
        const selectedIds = state.selectedIds.filter(
          (elementId) => elementId !== action.elementId,
        );

        return {
          ...state,
          selectedIds,
          selectedId:
            state.selectedId === action.elementId
              ? selectedIds.at(-1) ?? null
              : state.selectedId,
          activeSectionId: sectionId,
        };
      }

      return {
        ...state,
        selectedId: action.elementId,
        selectedIds: [
          ...state.selectedIds,
          action.elementId,
        ],
        activeSectionId: sectionId,
      };
    }
    case 'selection/clear':
      return {
        ...state,
        selectedId: null,
        selectedIds: [],
      };
    case 'selection/duplicate': {
      const result = duplicateSelectionInDocument(
        state.document,
        state.selectedIds,
      );

      if (!result) return state;

      return {
        ...committed(state, result.document),
        selectedId: result.elementIds.at(-1) ?? null,
        selectedIds: result.elementIds,
        activeSectionId: result.sectionId,
      };
    }
    case 'selection/remove': {
      if (state.selectedIds.length === 0) return state;

      return {
        ...committed(
          state,
          removeSelectionFromDocument(
            state.document,
            state.selectedIds,
          ),
        ),
        selectedId: null,
        selectedIds: [],
      };
    }
    case 'selection/patches': {
      const document = applySelectionPlacementPatches(
        state.document,
        state.breakpoint,
        action.patches,
      );

      if (document === state.document) return state;

      if (action.live) {
        return {
          ...state,
          document,
          dirty: true,
        };
      }

      return committed(state, document);
    }
    case 'section/activate':
      return {
        ...state,
        activeSectionId: action.sectionId,
        selectedId: null,
        selectedIds: [],
      };
    case 'element/add':
      return {
        ...committed(
          state,
          addElementToSection(
            state.document,
            action.element.sectionId,
            action.element,
          ),
        ),
        selectedId: action.element.id,
        selectedIds: [action.element.id],
        activeSectionId: action.element.sectionId,
      };
    case 'element/duplicate': {
      const result = duplicateElementInDocument(
        state.document,
        action.elementId,
      );

      if (!result) return state;

      return {
        ...committed(state, result.document),
        selectedId: result.element.id,
        selectedIds: [result.element.id],
        activeSectionId: result.element.sectionId,
      };
    }
    case 'element/remove': {
      const selectedIds = state.selectedIds.filter(
        (elementId) => elementId !== action.elementId,
      );

      return {
        ...committed(
          state,
          removeElement(state.document, action.elementId),
        ),
        selectedIds,
        selectedId:
          state.selectedId === action.elementId
            ? selectedIds.at(-1) ?? null
            : state.selectedId,
      };
    }
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
      return {
        ...committed(state, next),
        activeSectionId: action.sectionId,
        selectedId: null,
        selectedIds: [],
      };
    }
    case 'section/duplicate': {
      const result = duplicateSectionInDocument(
        state.document,
        state.pageId,
        action.sectionId,
      );

      if (!result) return state;

      return {
        ...committed(state, result.document),
        activeSectionId: result.section.id,
        selectedId: null,
        selectedIds: [],
      };
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
        selectedIds: [],
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
      const pageState = resolvePageState(
        previous,
        state.pageId,
        state.activeSectionId,
      );

      return {
        ...state,
        document: previous,
        past: state.past.slice(0, -1),
        future: [state.document, ...state.future].slice(0, 50),
        dirty: true,
        selectedIds: state.selectedIds.filter(
          (elementId) => Boolean(findElement(previous, elementId)),
        ),
        selectedId: findElement(previous, state.selectedId ?? '')
          ? state.selectedId
          : state.selectedIds.find(
              (elementId) => Boolean(findElement(previous, elementId)),
            ) ?? null,
        ...pageState,
      };
    }
    case 'history/redo': {
      const next = state.future[0];
      if (!next) return state;
      const pageState = resolvePageState(
        next,
        state.pageId,
        state.activeSectionId,
      );

      return {
        ...state,
        document: next,
        past: [...state.past, state.document].slice(-50),
        future: state.future.slice(1),
        dirty: true,
        selectedIds: state.selectedIds.filter(
          (elementId) => Boolean(findElement(next, elementId)),
        ),
        selectedId: findElement(next, state.selectedId ?? '')
          ? state.selectedId
          : state.selectedIds.find(
              (elementId) => Boolean(findElement(next, elementId)),
            ) ?? null,
        ...pageState,
      };
    }
    case 'draft/cloud-loading':
      return { ...state, cloud: { ...state.cloud, status: 'loading', message: null } };
    case 'draft/cloud-ready':
      return {
        ...state,
        dirty: state.dirty || action.markDirty,
        cloud: {
          status: 'saved',
          pageId: action.pageId,
          lockVersion: action.lockVersion,
          message: null,
        },
      };
    case 'draft/hydrate': {
      const document = normalizeLoadedDocument(
        action.document,
      );
      const page = document.pages[0];
      const migrated =
        document.siteKitVersion !==
          action.document.siteKitVersion ||
        document.pages.length !==
          action.document.pages.length ||
        document.navigation.links.length !==
          action.document.navigation.links.length ||
        document.footer.links.length !==
          action.document.footer.links.length;
      const dirty = action.markDirty || migrated;

      return {
        ...state,
        document,
        pageId: page?.id ?? state.pageId,
        activeSectionId:
          page?.sections[0]?.id ??
          state.activeSectionId,
        selectedId: null,
        selectedIds: [],
        dirty,
        savedAt: action.savedAt,
        past: [],
        future: [],
        interactionBase: null,
        cloud: {
          status:
            action.pageId === null
              ? 'local'
              : 'saved',
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
    case 'vault/loading':
      return {
        ...state,
        vault: {
          ...state.vault,
          available: true,
          status: 'loading',
          message: null,
        },
      };
    case 'vault/saving':
      return {
        ...state,
        vault: {
          ...state.vault,
          available: true,
          status: 'saving',
          message: null,
        },
      };
    case 'vault/ready':
      return {
        ...state,
        vault: {
          available: action.status.available,
          status: action.status.available ? 'saved' : 'web',
          path: action.status.path,
          savedAt: action.status.savedAt,
          backupCount: action.status.backupCount,
          message: null,
        },
      };
    case 'vault/error':
      return {
        ...state,
        vault: {
          ...state.vault,
          available: true,
          status: 'error',
          message: action.message,
        },
      };
    case 'draft/reset': {
      const document =
        state.document.siteKit === 'atelierexpression'
          ? normalizeLoadedDocument(
              cloneDocument(initialSiteDocument),
            )
          : createBlankSiteDocument(
              state.document.branding.title,
            );

      return {
        ...state,
        document,
        pageId:
          document.pages[0]?.id ?? state.pageId,
        selectedId: null,
        selectedIds: [],
        activeSectionId:
          document.pages[0]?.sections[0]?.id ??
          'hero',
        past: [
          ...state.past.slice(-49),
          state.document,
        ],
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

export function EditorProvider({
  children,
}: PropsWithChildren) {
  const { mode: authMode, user } = useAuth();
  const {
    status: siteStatus,
    activeSite,
  } = useSiteWorkspace();
  const [state, dispatch] = useReducer(
    editorReducer,
    undefined,
    initialState,
  );

  const stateRef = useRef(state);
  const saveInFlightRef =
    useRef<Promise<SaveResult> | null>(null);
  const cloudLockVersionRef = useRef(
    state.cloud.lockVersion,
  );
  const hydrationSequenceRef = useRef(0);

  stateRef.current = state;

  if (!saveInFlightRef.current) {
    cloudLockVersionRef.current =
      state.cloud.lockVersion;
  }

  const draftScope = useMemo<DraftScope | null>(() => {
    if (!activeSite) return null;

    return {
      accountId:
        authMode === 'signed-in' && user
          ? user.id
          : 'local',
      siteId: activeSite.id,
      siteSlug: activeSite.slug,
    };
  }, [
    activeSite?.id,
    activeSite?.slug,
    authMode,
    user?.id,
  ]);

  useEffect(() => {
    saveInFlightRef.current = null;
    cloudLockVersionRef.current = 0;
  }, [activeSite?.id]);

  const saveOnce =
    useCallback((): Promise<SaveResult> => {
      if (saveInFlightRef.current) {
        return saveInFlightRef.current;
      }

      const scope = draftScope;
      const snapshot = stateRef.current;
      const document = snapshot.document;
      const savedAt = Date.now();

      const task = (async (): Promise<SaveResult> => {
        if (!scope || !activeSite) {
          throw new Error(
            'Aucun site actif n’est prêt pour la sauvegarde.',
          );
        }

        saveLocalDraft(scope, {
          document,
          savedAt,
        });

        if (
          authMode === 'signed-in' &&
          user &&
          isDesktopVaultAvailable()
        ) {
          dispatch({ type: 'vault/saving' });

          try {
            const vaultStatus = await saveDesktopVault(
              {
                accountId: user.id,
                siteId: activeSite.id,
              },
              {
                document,
                savedAt,
              },
            );

            dispatch({
              type: 'vault/ready',
              status: vaultStatus,
            });
          } catch (error: unknown) {
            dispatch({
              type: 'vault/error',
              message:
                error instanceof Error
                  ? error.message
                  : 'Impossible d’écrire dans le coffre local chiffré.',
            });
          }
        }

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
            'Le brouillon cloud de ce site n’est pas prêt.',
          );
        }

        dispatch({ type: 'draft/saving' });

        try {
          const saved = await saveCloudDraft(
            pageId,
            document,
            cloudLockVersionRef.current,
          );

          cloudLockVersionRef.current =
            saved.lockVersion;

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
            dispatch({
              type: 'draft/error',
              message:
                error instanceof Error
                  ? error.message
                  : 'Impossible de synchroniser le brouillon.',
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
    }, [
      activeSite,
      authMode,
      draftScope,
      user,
    ]);

  const saveNow =
    useCallback(async (): Promise<number | null> => {
      let saved = await saveOnce();

      while (
        stateRef.current.document !== saved.document
      ) {
        saved = await saveOnce();
      }

      return saved.lockVersion;
    }, [saveOnce]);

  useEffect(() => {
    if (
      siteStatus === 'loading' ||
      !draftScope ||
      !activeSite
    ) {
      return;
    }

    const sequence =
      hydrationSequenceRef.current + 1;
    hydrationSequenceRef.current = sequence;
    const hydrationBaseDocument =
      stateRef.current.document;
    const hydrationBaseDirty =
      stateRef.current.dirty;

    const applyHydration = (
      document: SiteDocument,
      pageId: string | null,
      lockVersion: number,
      savedAt: number,
      markDirty: boolean,
    ) => {
      if (
        hydrationSequenceRef.current !== sequence
      ) {
        return;
      }

      dispatch({
        type: 'draft/hydrate',
        document,
        pageId,
        lockVersion,
        savedAt,
        markDirty,
      });
    };

    const local = loadLocalDraft(draftScope);

    if (authMode !== 'signed-in' || !user) {
      const document =
        local?.document ??
        (activeSite.slug === 'atelier-expression'
          ? cloneDocument(initialSiteDocument)
          : createBlankSiteDocument(activeSite.name));

      applyHydration(
        document,
        null,
        0,
        local?.savedAt ?? Date.now(),
        false,
      );
      return;
    }

    dispatch({ type: 'draft/cloud-loading' });

    if (isDesktopVaultAvailable()) {
      dispatch({ type: 'vault/loading' });
    }

    const desktopPromise = isDesktopVaultAvailable()
      ? loadDesktopVault({
          accountId: user.id,
          siteId: activeSite.id,
        }).catch((error: unknown) => {
          dispatch({
            type: 'vault/error',
            message:
              error instanceof Error
                ? error.message
                : 'Impossible de lire le coffre local chiffré.',
          });
          return null;
        })
      : Promise.resolve(null);

    void Promise.all([
      loadCloudDraft(activeSite.id),
      desktopPromise,
    ])
      .then(([cloudDraft, desktopResult]) => {
        if (
          hydrationSequenceRef.current !== sequence
        ) {
          return;
        }

        if (desktopResult) {
          dispatch({
            type: 'vault/ready',
            status: desktopResult.status,
          });
        }

        if (
          shouldPreserveEditsDuringHydration(
            hydrationBaseDocument,
            stateRef.current.document,
            hydrationBaseDirty,
            stateRef.current.dirty,
          )
        ) {
          dispatch({
            type: 'draft/cloud-ready',
            pageId: cloudDraft.pageId,
            lockVersion: cloudDraft.lockVersion,
            markDirty: true,
          });
          return;
        }

        const candidates: Array<{
          source: 'browser' | 'desktop' | 'cloud';
          document: SiteDocument;
          savedAt: number;
        }> = [];

        if (local) {
          candidates.push({
            source: 'browser',
            document: local.document,
            savedAt: local.savedAt,
          });
        }

        if (desktopResult?.envelope) {
          candidates.push({
            source: 'desktop',
            document: desktopResult.envelope.document,
            savedAt: desktopResult.envelope.savedAt,
          });
        }

        if (cloudDraft.document) {
          candidates.push({
            source: 'cloud',
            document: cloudDraft.document,
            savedAt: cloudDraft.updatedAt ?? 0,
          });
        }

        candidates.sort(
          (left, right) => right.savedAt - left.savedAt,
        );

        const newest = candidates[0];

        if (newest) {
          saveLocalDraft(draftScope, {
            document: newest.document,
            savedAt: newest.savedAt,
          });

          if (
            isDesktopVaultAvailable() &&
            newest.source !== 'desktop'
          ) {
            void saveDesktopVault(
              {
                accountId: user.id,
                siteId: activeSite.id,
              },
              {
                document: newest.document,
                savedAt: newest.savedAt,
              },
            )
              .then((status) => {
                dispatch({
                  type: 'vault/ready',
                  status,
                });
              })
              .catch((error: unknown) => {
                dispatch({
                  type: 'vault/error',
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Impossible de mettre à jour le coffre local chiffré.',
                });
              });
          }

          applyHydration(
            newest.document,
            cloudDraft.pageId,
            cloudDraft.lockVersion,
            newest.savedAt || Date.now(),
            newest.source !== 'cloud',
          );
          return;
        }

        const fallback =
          activeSite.slug === 'atelier-expression'
            ? cloneDocument(initialSiteDocument)
            : createBlankSiteDocument(
                activeSite.name,
              );
        const savedAt = Date.now();

        saveLocalDraft(draftScope, {
          document: fallback,
          savedAt,
        });

        if (isDesktopVaultAvailable()) {
          void saveDesktopVault(
            {
              accountId: user.id,
              siteId: activeSite.id,
            },
            {
              document: fallback,
              savedAt,
            },
          )
            .then((status) => {
              dispatch({
                type: 'vault/ready',
                status,
              });
            })
            .catch((error: unknown) => {
              dispatch({
                type: 'vault/error',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Impossible d’initialiser le coffre local chiffré.',
              });
            });
        }

        applyHydration(
          fallback,
          cloudDraft.pageId,
          cloudDraft.lockVersion,
          savedAt,
          true,
        );
      })
      .catch((error: unknown) => {
        if (
          hydrationSequenceRef.current !== sequence
        ) {
          return;
        }

        dispatch({
          type: 'draft/error',
          message:
            error instanceof Error
              ? error.message
              : 'Impossible de charger le brouillon du site.',
        });
      });

    return () => {
      if (
        hydrationSequenceRef.current === sequence
      ) {
        hydrationSequenceRef.current += 1;
      }
    };
  }, [
    activeSite?.id,
    activeSite?.name,
    activeSite?.slug,
    authMode,
    draftScope,
    siteStatus,
    user?.id,
  ]);

  useEffect(() => {
    if (
      !state.dirty ||
      state.cloud.status === 'saving' ||
      !activeSite
    ) {
      return;
    }

    const handle = window.setTimeout(() => {
      void saveNow().catch(() => {
        // L’état d’erreur est déjà enregistré dans le store.
      });
    }, 5000);

    return () => window.clearTimeout(handle);
  }, [
    activeSite,
    saveNow,
    state.cloud.status,
    state.dirty,
    state.document,
  ]);

  useEffect(() => {
    if (!draftScope) return;

    const handleBeforeUnload = () => {
      const snapshot = stateRef.current;

      if (!snapshot.dirty) return;

      saveLocalDraft(draftScope, {
        document: snapshot.document,
        savedAt: Date.now(),
      });
    };

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload,
    );

    return () => {
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload,
      );
    };
  }, [draftScope]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      saveNow,
    }),
    [state, saveNow],
  );

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) throw new Error('useEditor must be used inside EditorProvider');
  return context;
}


export function createUploadedImageElement(
  sectionId: string,
  publicUrl: string,
  aspectRatio: number,
  fileName: string,
): SceneElement {
  return {
    id: `image-${crypto.randomUUID().slice(0, 8)}`,
    sectionId,
    type: 'image',
    source: {
      kind: 'url',
      url: publicUrl,
    },
    altText: {
      'fr-CA': fileName,
    },
    cornerRadius: 0,
    aspectRatio,
    fit: 'contain',
    placement: {
      desktop: {
        xPercent: 50,
        yPercent: 50,
        widthPercent: 28,
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
    aspectRatio: 0.82,
    fit: 'cover',
    placement,
    visible: true,
    locked: false,
  };
}
