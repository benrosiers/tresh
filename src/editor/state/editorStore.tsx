import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import {
  addElementToSection,
  cloneDocument,
  findElement,
  moveSection,
  patchPlacement,
  removeElement,
  updateElement,
  updateSection,
} from '../model/documentOps';
import { initialSiteDocument } from '../model/initialDocument';
import {
  parseSiteDocument,
  type Breakpoint,
  type Placement,
  type SceneElement,
  type SiteDocument,
} from '../model/siteDocument';

const STORAGE_KEY = 'tresh.local-draft.atelierexpression.v1';

export type EditorMode = 'simple' | 'advanced';

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
}

type EditorAction =
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
  | { type: 'interaction/start' }
  | { type: 'interaction/end' }
  | { type: 'history/undo' }
  | { type: 'history/redo' }
  | { type: 'draft/saved'; savedAt: number }
  | { type: 'draft/reset' }
  | { type: 'publish-notice/open' }
  | { type: 'publish-notice/close' };

interface EditorContextValue {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
}

const EditorContext = createContext<EditorContextValue | null>(null);

function loadDocument(): SiteDocument {
  if (typeof window === 'undefined') return cloneDocument(initialSiteDocument);
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return cloneDocument(initialSiteDocument);

  try {
    return parseSiteDocument(JSON.parse(stored));
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return cloneDocument(initialSiteDocument);
  }
}

function initialState(): EditorState {
  const document = loadDocument();
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
    savedAt: null,
    past: [],
    future: [],
    interactionBase: null,
    publishNoticeOpen: false,
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
      return {
        ...state,
        document: previous,
        past: state.past.slice(0, -1),
        future: [state.document, ...state.future].slice(0, 50),
        dirty: true,
        selectedId: findElement(previous, state.selectedId ?? '') ? state.selectedId : null,
      };
    }
    case 'history/redo': {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        document: next,
        past: [...state.past, state.document].slice(-50),
        future: state.future.slice(1),
        dirty: true,
        selectedId: findElement(next, state.selectedId ?? '') ? state.selectedId : null,
      };
    }
    case 'draft/saved':
      return { ...state, dirty: false, savedAt: action.savedAt };
    case 'draft/reset': {
      window.localStorage.removeItem(STORAGE_KEY);
      const document = cloneDocument(initialSiteDocument);
      return {
        ...state,
        document,
        selectedId: null,
        activeSectionId: document.pages[0]?.sections[0]?.id ?? 'hero',
        past: [],
        future: [],
        interactionBase: null,
        dirty: false,
        savedAt: Date.now(),
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
  const [state, dispatch] = useReducer(editorReducer, undefined, initialState);

  useEffect(() => {
    if (!state.dirty) return;
    const handle = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.document));
      dispatch({ type: 'draft/saved', savedAt: Date.now() });
    }, 650);

    return () => window.clearTimeout(handle);
  }, [state.document, state.dirty]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) throw new Error('useEditor must be used inside EditorProvider');
  return context;
}

export function createElementForTool(
  tool: 'heading' | 'text' | 'button' | 'image' | 'paint' | 'section',
  sectionId: string,
): SceneElement | null {
  if (tool === 'section') return null;
  const id = `${tool}-${crypto.randomUUID().slice(0, 8)}`;
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
