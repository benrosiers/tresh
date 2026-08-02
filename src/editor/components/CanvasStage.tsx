import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { flushSync } from 'react-dom';
import Moveable from 'react-moveable';
import { CanvasDiagnostics } from './CanvasDiagnostics';
import {
  hasBlockingEditorMenuFocus,
  hasBlockingEditorOverlay,
} from './editorOverlay';
import { SiteFooterPreview, SiteNavbarPreview } from './SiteChrome';
import { uploadSiteMedia } from '../../media/siteMedia';
import { findElement, getPage, resolvePlacement } from '../model/documentOps';
import {
  layoutSelection,
  type SelectionBox,
  type SelectionLayoutCommand,
  type SelectionPlacementPatches,
} from '../model/selectionOps';
import { resolveButtonStyle, resolveTextTypography } from '../model/siteDocument';
import type {
  Placement,
  SceneElement,
  SectionDocument,
  ShapeElement,
  ShapeKind,
  TextFontFamily,
} from '../model/siteDocument';
import {
  createElementForTool,
  createUploadedImageElement,
  useEditor,
} from '../state/editorStore';
import {
  externalMediaFingerprint,
  hasExternalFileTransfer,
  selectExternalMediaFile,
} from '../model/externalMediaDrop';
import {
  focalPointFromClient,
  resolveImageCrop,
} from '../model/imageCrop';
import {
  hasPaletteToolTransfer,
  isPaletteToolId,
  PALETTE_DRAG_END_EVENT,
  PALETTE_TOOL_MIME,
  placePaletteElementAtPoint,
} from '../model/paletteDragDrop';
import {
  getDefaultViewportPresetId,
  getViewportPreset,
  isViewportPresetId,
  VIEWPORT_PRESETS,
  type CanvasViewMode,
  type ViewportPresetId,
} from '../model/viewportMode';
import { FRAME_WIDTH, PAINT_COLORS } from './editorConstants';

interface InteractionStart {
  placement: Placement;
  sectionWidth: number;
  sectionHeight: number;
}

interface GroupDragEntry {
  id: string;
  target: HTMLElement;
  placement: Placement;
  sectionWidth: number;
  sectionHeight: number;
}

type ExternalMediaFeedback =
  | {
      kind: 'uploading' | 'success' | 'error';
      message: string;
    }
  | null;

interface RecentExternalMediaDrop {
  fingerprint: string;
  at: number;
}

const EXTERNAL_MEDIA_DUPLICATE_WINDOW_MS = 1500;
const EXTERNAL_MEDIA_FEEDBACK_DURATION_MS = 4500;

const SELECTION_LAYOUT_ACTIONS: Array<{
  command: SelectionLayoutCommand;
  label: string;
  glyph: string;
}> = [
  { command: 'left', label: 'Aligner à gauche', glyph: 'L' },
  {
    command: 'center-horizontal',
    label: 'Centrer horizontalement',
    glyph: 'CX',
  },
  { command: 'right', label: 'Aligner à droite', glyph: 'R' },
  { command: 'top', label: 'Aligner en haut', glyph: 'T' },
  {
    command: 'center-vertical',
    label: 'Centrer verticalement',
    glyph: 'CY',
  },
  { command: 'bottom', label: 'Aligner en bas', glyph: 'B' },
  {
    command: 'distribute-horizontal',
    label: 'Distribuer horizontalement',
    glyph: 'DH',
  },
  {
    command: 'distribute-vertical',
    label: 'Distribuer verticalement',
    glyph: 'DV',
  },
];

const MIN_ZOOM_PERCENT = 5;
const MAX_ZOOM_PERCENT = 200;
const ZOOM_STEP_PERCENT = 5;

const ZOOM_STORAGE_KEY = 'tresh.canvas.zoom-percent';
const FIT_STORAGE_KEY = 'tresh.canvas.fit-enabled';
const VIEW_MODE_STORAGE_KEY = 'tresh.canvas.view-mode';
const VIEWPORT_PRESET_STORAGE_KEY = 'tresh.canvas.viewport-preset';

const VIEWPORT_HORIZONTAL_PADDING = 72;
const VIEWPORT_VERTICAL_PADDING = 106;

const TEXT_FONT_STACKS: Record<TextFontFamily, string> = {
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  system:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

type ButtonCssProperties = CSSProperties & {
  [key: `--button-${string}`]: string | number;
};

function buttonCssProperties(
  element: Extract<SceneElement, { type: 'button' }>,
): ButtonCssProperties {
  const style = resolveButtonStyle(element);

  return {
    '--button-bg': style.backgroundColor,
    '--button-text': style.textColor,
    '--button-border': style.borderColor,
    '--button-border-width': `${style.borderWidth}px`,
    '--button-radius': `${style.borderRadius}px`,
    '--button-font-family': TEXT_FONT_STACKS[style.fontFamily],
    '--button-font-size': `${style.fontSize}px`,
    '--button-font-weight': style.fontWeight,
    '--button-hover-bg': style.hoverBackgroundColor,
    '--button-hover-text': style.hoverTextColor,
    '--button-hover-border': style.hoverBorderColor,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readStoredZoom(): number {
  try {
    const stored = window.localStorage.getItem(ZOOM_STORAGE_KEY);
    const value = stored === null ? 100 : Number(stored);

    if (!Number.isFinite(value)) return 100;

    return clamp(
      Math.round(value),
      MIN_ZOOM_PERCENT,
      MAX_ZOOM_PERCENT,
    );
  } catch {
    return 100;
  }
}

function readStoredFitMode(): boolean {
  try {
    return window.localStorage.getItem(FIT_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function readStoredViewMode(): CanvasViewMode {
  try {
    return window.localStorage.getItem(VIEW_MODE_STORAGE_KEY) === 'viewport'
      ? 'viewport'
      : 'page';
  } catch {
    return 'page';
  }
}

function readStoredViewportPreset(): ViewportPresetId {
  try {
    const value = window.localStorage.getItem(
      VIEWPORT_PRESET_STORAGE_KEY,
    );

    return isViewportPresetId(value)
      ? value
      : getDefaultViewportPresetId('desktop');
  } catch {
    return getDefaultViewportPresetId('desktop');
  }
}

function localized(element: Extract<SceneElement, { type: 'text' }>): string {
  return element.text['fr-CA'] ?? '';
}

const FIXED_RATIO_SHAPES: ShapeKind[] = [
  'square',
  'circle',
  'triangle',
  'diamond',
  'star',
];

function hexToRgba(color: string, opacity: number): string {
  const normalized = color.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(0, 0, 0, ${opacity})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(opacity, 0, 1)})`;
}

function resolveEffectsFilter(element: SceneElement): string | undefined {
  const filters: string[] = [];
  const shadow = element.effects?.shadow;
  if (shadow?.enabled) {
    filters.push(
      `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${hexToRgba(
        shadow.color,
        shadow.opacity,
      )})`,
    );
  }

  const glow = element.effects?.glow;
  if (glow?.enabled) {
    filters.push(
      `drop-shadow(0 0 ${Math.max(1, glow.blur * 0.45)}px ${hexToRgba(
        glow.color,
        glow.intensity,
      )})`,
    );
    filters.push(
      `drop-shadow(0 0 ${glow.blur}px ${hexToRgba(
        glow.color,
        glow.intensity * 0.65,
      )})`,
    );
  }

  return filters.length > 0 ? filters.join(' ') : undefined;
}

function ShapeSvg({ element }: { element: ShapeElement }) {
  const stroke = element.strokeWidth > 0 ? element.strokeColor : 'none';
  const shared = {
    fill: element.fillColor,
    stroke,
    strokeWidth: element.strokeWidth,
    vectorEffect: 'non-scaling-stroke' as const,
    strokeLinejoin: 'round' as const,
  };

  let content: ReactNode = null;

  switch (element.shapeKind) {
    case 'rectangle':
    case 'square':
      content = (
        <rect
          x="2"
          y="2"
          width="96"
          height="96"
          rx={element.cornerRadius}
          ry={element.cornerRadius}
          {...shared}
        />
      );
      break;
    case 'circle':
      content = <circle cx="50" cy="50" r="48" {...shared} />;
      break;
    case 'ellipse':
      content = <ellipse cx="50" cy="50" rx="48" ry="46" {...shared} />;
      break;
    case 'triangle':
      content = <polygon points="50,2 98,98 2,98" {...shared} />;
      break;
    case 'diamond':
      content = <polygon points="50,2 98,50 50,98 2,50" {...shared} />;
      break;
    case 'star':
      content = (
        <polygon
          points="50,2 61,35 96,35 68,56 79,92 50,71 21,92 32,56 4,35 39,35"
          {...shared}
        />
      );
      break;
    case 'line':
      content = (
        <line
          x1="3"
          y1="50"
          x2="97"
          y2="50"
          stroke={element.strokeColor}
          strokeWidth={Math.max(1, element.strokeWidth || 4)}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      );
      break;
  }

  return (
    <svg
      className="shape-node"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}

function ElementNode({
  element,
  selected,
  primary,
  editing,
  onSelect,
  onEdit,
  onTextCommit,
}: {
  element: SceneElement;
  selected: boolean;
  primary: boolean;
  editing: boolean;
  onSelect: (additive: boolean) => void;
  onEdit: () => void;
  onTextCommit: (value: string) => void;
}) {
  const { state, dispatch } = useEditor();
  const placement = resolvePlacement(element.placement, state.breakpoint);
  const focalPointerIdRef = useRef<number | null>(null);

  const updateImageFocalFromPointer = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (
      element.type !== 'image' ||
      focalPointerIdRef.current !== event.pointerId
    ) {
      return;
    }

    const imageFrame = event.currentTarget.closest<HTMLElement>(
      '[data-element-id]',
    );

    if (!imageFrame) return;

    const focal = focalPointFromClient(
      {
        clientX: event.clientX,
        clientY: event.clientY,
      },
      imageFrame.getBoundingClientRect(),
    );

    dispatch({
      type: 'placement/patch',
      elementId: element.id,
      patch: {
        imageFocalX: focal.x,
        imageFocalY: focal.y,
      },
      live: true,
    });
  };

  const startImageFocalDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (element.type !== 'image') return;

    event.preventDefault();
    event.stopPropagation();
    focalPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    dispatch({ type: 'interaction/start' });
    updateImageFocalFromPointer(event);
  };

  const finishImageFocalDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (focalPointerIdRef.current !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    focalPointerIdRef.current = null;
    dispatch({ type: 'interaction/end' });
  };

  const fixedRatioShape =
    element.type === 'shape' && FIXED_RATIO_SHAPES.includes(element.shapeKind);

  const commonStyle: CSSProperties = {
    left: `${placement.xPercent}%`,
    top: `${placement.yPercent}%`,
    width: `${placement.widthPercent}%`,
    height:
      element.type === 'shape' && !fixedRatioShape
        ? `${placement.heightPercent ?? 18}%`
        : element.type === 'image' &&
            placement.heightPercent !== undefined
          ? `${placement.heightPercent}%`
          : undefined,
    opacity: placement.opacity,
    zIndex: placement.zIndex,
    filter: resolveEffectsFilter(element),
    transform: `translate(-50%, -50%) rotate(${placement.rotationDegrees}deg)`,
  };

  const typographyStyle: CSSProperties =
    element.type === 'text'
      ? (() => {
          const typography = resolveTextTypography(element);

          return {
            color: typography.color,
            fontFamily: TEXT_FONT_STACKS[typography.fontFamily],
            fontWeight: typography.fontWeight,
            fontStyle: typography.fontStyle,
            textAlign: typography.textAlign,
            lineHeight: typography.lineHeight,
            letterSpacing: `${typography.letterSpacing}em`,
            textTransform: typography.textTransform,
          };
        })()
      : {};

  if (fixedRatioShape) {
    commonStyle.aspectRatio = '1';
  } else if (element.type === 'paint') {
    commonStyle.aspectRatio = '1';
  } else if (
    element.type === 'image' &&
    placement.heightPercent === undefined
  ) {
    commonStyle.aspectRatio = String(element.aspectRatio ?? 0.82);
  }

  const commonProps = {
    'data-element-id': element.id,
    className: `canvas-element canvas-element--${element.type} ${selected ? 'is-selected' : ''} ${primary ? 'is-primary-selected' : ''} ${element.locked ? 'is-locked' : ''}`,
    style: commonStyle,
    onPointerDown: (event: ReactPointerEvent) => {
      event.stopPropagation();
      onSelect(event.shiftKey);
    },
  };

  if (!element.visible) return null;

  if (element.type === 'paint') {
    return (
      <div {...commonProps} aria-label={`Peinture ${element.assetKey}`}>
        <div
          className="paint-blob"
          style={{
            background: element.customColor ?? PAINT_COLORS[element.assetKey],
          }}
        />
      </div>
    );
  }

  if (element.type === 'shape') {
    return (
      <div {...commonProps} aria-label={`Forme ${element.shapeKind}`}>
        <ShapeSvg element={element} />
      </div>
    );
  }

  if (element.type === 'image') {
    const source =
      element.source.kind === 'url'
        ? element.source.url
        : undefined;
    const crop = resolveImageCrop(
      element,
      state.breakpoint,
    );

    return (
      <div
        {...commonProps}
        style={{
          ...commonStyle,
          borderRadius: element.cornerRadius,
        }}
      >
        {source ? (
          <>
            <img
              src={source}
              alt={element.altText['fr-CA'] ?? ''}
              style={{
                borderRadius: element.cornerRadius,
                objectFit: crop.fit,
                objectPosition: `${crop.focalX}% ${crop.focalY}%`,
                background: 'transparent',
              }}
            />

            {primary && (
              <>
                <span
                  className="image-crop-frame"
                  aria-hidden="true"
                />

                {crop.fit !== 'fill' && (
                  <button
                    type="button"
                    className="image-focal-handle"
                    style={{
                      left: `${crop.focalX}%`,
                      top: `${crop.focalY}%`,
                    }}
                    aria-label={`Point focal ${Math.round(
                      crop.focalX,
                    )} par ${Math.round(crop.focalY)}`}
                    title="Glisse pour déplacer le point focal"
                    onPointerDown={startImageFocalDrag}
                    onPointerMove={updateImageFocalFromPointer}
                    onPointerUp={finishImageFocalDrag}
                    onPointerCancel={finishImageFocalDrag}
                  >
                    <span aria-hidden="true" />
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          <div
            className="image-placeholder"
            style={{ borderRadius: element.cornerRadius }}
          >
            <span>▨</span>
            <strong>
              {element.source.kind === 'placeholder'
                ? element.source.label
                : 'Média'}
            </strong>
          </div>
        )}
      </div>
    );
  }

  if (element.type === 'button') {
    return (
      <div {...commonProps}>
        <span
          className={`site-button site-button--${element.variant}`}
          style={buttonCssProperties(element)}
        >
          {element.label['fr-CA'] ?? 'Bouton'}
        </span>
      </div>
    );
  }

  if (editing) {
    return (
      <textarea
        {...commonProps}
        className={`${commonProps.className} canvas-inline-editor site-text site-text--${element.variant}`}
        style={{
          ...commonStyle,
          ...typographyStyle,
          fontSize: placement.fontSize ?? 17,
        }}
        defaultValue={localized(element)}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onPointerDown={(event) => event.stopPropagation()}
        onBlur={(event) => onTextCommit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.currentTarget.blur();
          }

          if (
            (event.metaKey || event.ctrlKey) &&
            event.key === 'Enter'
          ) {
            event.currentTarget.blur();
          }
        }}
      />
    );
  }

  const Tag = element.variant === 'heading' ? 'h2' : 'div';

  return (
    <Tag
      {...commonProps}
      className={`${commonProps.className} site-text site-text--${element.variant}`}
      style={{
        ...commonStyle,
        ...typographyStyle,
        fontSize: placement.fontSize ?? 17,
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onEdit();
      }}
    >
      {localized(element)}
    </Tag>
  );
}

function CanvasSection({
  section,
  onActivate,
  selectedId,
  selectedIds,
  editingId,
  paletteDropActive,
  externalMediaDropActive,
  onSelectElement,
  onEditElement,
  onTextCommit,
}: {
  section: SectionDocument;
  onActivate: () => void;
  selectedId: string | null;
  selectedIds: string[];
  editingId: string | null;
  paletteDropActive: boolean;
  externalMediaDropActive: boolean;
  onSelectElement: (
    element: SceneElement,
    additive: boolean,
  ) => void;
  onEditElement: (elementId: string) => void;
  onTextCommit: (elementId: string, value: string) => void;
}) {
  const { state } = useEditor();
  const height = section.height[state.breakpoint];

  return (
    <section
      id={section.id}
      className={[
        'site-section',
        paletteDropActive ? 'is-palette-drop-target' : '',
        externalMediaDropActive ? 'is-external-media-drop-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-section-id={section.id}
      style={{ height }}
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) {
          onActivate();
        }
      }}
    >
      <span className="site-section__tag">
        {section.label}
      </span>

      {section.scene.map((element) => (
        <ElementNode
          element={element}
          selected={selectedIds.includes(element.id)}
          primary={selectedId === element.id}
          editing={editingId === element.id}
          onSelect={(additive) =>
            onSelectElement(element, additive)
          }
          onEdit={() => onEditElement(element.id)}
          onTextCommit={(value) => onTextCommit(element.id, value)}
          key={element.id}
        />
      ))}
    </section>
  );
}

export function CanvasStage() {
  const { state, dispatch } = useEditor();

  const page = getPage(state.document, state.pageId);
  const responsiveFrameWidth = FRAME_WIDTH[state.breakpoint];

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const frameWindowRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const moveableRef = useRef<{ updateRect: () => void } | null>(null);
  const interactionRef = useRef<InteractionStart | null>(null);
  const interactionPatchRef = useRef<Partial<Placement>>({});
  const groupDragRef = useRef<GroupDragEntry[]>([]);
  const groupPatchRef =
    useRef<SelectionPlacementPatches>({});
  const externalMediaUploadBusyRef = useRef(false);
  const recentExternalMediaDropRef =
    useRef<RecentExternalMediaDrop | null>(null);
  const externalMediaFeedbackTimerRef =
    useRef<number | null>(null);

  const [zoomPercent, setZoomPercent] = useState(readStoredZoom);
  const [fitMode, setFitMode] = useState(readStoredFitMode);
  const [viewMode, setViewMode] =
    useState<CanvasViewMode>(readStoredViewMode);
  const [viewportPresetId, setViewportPresetId] =
    useState<ViewportPresetId>(readStoredViewportPreset);
  const [viewportScrollTop, setViewportScrollTop] = useState(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [selectionUiSuppressed, setSelectionUiSuppressed] = useState(false);
  const [paletteDropSectionId, setPaletteDropSectionId] =
    useState<string | null>(null);
  const [
    externalMediaDropSectionId,
    setExternalMediaDropSectionId,
  ] = useState<string | null>(null);
  const [externalMediaFeedback, setExternalMediaFeedback] =
    useState<ExternalMediaFeedback>(null);

  const viewportPreset = getViewportPreset(viewportPresetId);
  const frameWidth =
    viewMode === 'viewport'
      ? viewportPreset.width
      : responsiveFrameWidth;
  const scale = zoomPercent / 100;

  const visibleSections = useMemo(
    () => page?.sections.filter((section) => section.visible) ?? [],
    [page],
  );

  const sectionHeight = visibleSections.reduce(
    (total, section) =>
      total + section.height[state.breakpoint],
    0,
  );

  const navigationHeight = state.document.navigation.visible
    ? state.document.navigation.height[state.breakpoint]
    : 0;

  const footerHeight = state.document.footer.visible
    ? state.document.footer.height[state.breakpoint]
    : 0;

  const totalHeight =
    navigationHeight + sectionHeight + footerHeight;
  const visibleFrameHeight =
    viewMode === 'viewport'
      ? viewportPreset.height
      : totalHeight;
  const viewportScrollMaximum = Math.max(
    0,
    totalHeight - viewportPreset.height,
  );

  const updateFitScale = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) return;

    const availableWidth = Math.max(
      1,
      viewport.clientWidth - VIEWPORT_HORIZONTAL_PADDING,
    );

    const availableHeight = Math.max(
      1,
      viewport.clientHeight - VIEWPORT_VERTICAL_PADDING,
    );

    const widthScale = availableWidth / frameWidth;
    const heightScale =
      availableHeight / Math.max(visibleFrameHeight, 1);

    const nextPercent = clamp(
      Math.floor(
        Math.min(widthScale, heightScale) * 100,
      ),
      MIN_ZOOM_PERCENT,
      MAX_ZOOM_PERCENT,
    );

    setZoomPercent(nextPercent);
  }, [frameWidth, visibleFrameHeight]);

  const setManualZoom = useCallback((value: number) => {
    setFitMode(false);

    setZoomPercent(
      clamp(
        Math.round(value),
        MIN_ZOOM_PERCENT,
        MAX_ZOOM_PERCENT,
      ),
    );
  }, []);

  const enableFitMode = useCallback(() => {
    setFitMode(true);

    window.requestAnimationFrame(() => {
      updateFitScale();
    });
  }, [updateFitScale]);

  const showExternalMediaFeedback = useCallback(
    (feedback: ExternalMediaFeedback) => {
      if (externalMediaFeedbackTimerRef.current !== null) {
        window.clearTimeout(
          externalMediaFeedbackTimerRef.current,
        );
        externalMediaFeedbackTimerRef.current = null;
      }

      setExternalMediaFeedback(feedback);

      if (
        feedback &&
        feedback.kind !== 'uploading'
      ) {
        externalMediaFeedbackTimerRef.current =
          window.setTimeout(() => {
            setExternalMediaFeedback(null);
            externalMediaFeedbackTimerRef.current = null;
          }, EXTERNAL_MEDIA_FEEDBACK_DURATION_MS);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (externalMediaFeedbackTimerRef.current !== null) {
        window.clearTimeout(
          externalMediaFeedbackTimerRef.current,
        );
      }
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ZOOM_STORAGE_KEY,
        String(zoomPercent),
      );
    } catch {
      // Le zoom reste utilisable même si localStorage est bloqué.
    }
  }, [zoomPercent]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        FIT_STORAGE_KEY,
        String(fitMode),
      );
    } catch {
      // Le mode Ajuster reste utilisable sans persistance locale.
    }
  }, [fitMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        VIEW_MODE_STORAGE_KEY,
        viewMode,
      );
      window.localStorage.setItem(
        VIEWPORT_PRESET_STORAGE_KEY,
        viewportPresetId,
      );
    } catch {
      // Les préférences du canevas restent utilisables sans persistance.
    }
  }, [viewMode, viewportPresetId]);

  useEffect(() => {
    if (viewMode !== 'viewport') return;

    const currentPreset = getViewportPreset(viewportPresetId);
    if (currentPreset.breakpoint === state.breakpoint) return;

    setViewportPresetId(
      getDefaultViewportPresetId(state.breakpoint),
    );
  }, [state.breakpoint, viewMode, viewportPresetId]);

  useEffect(() => {
    const frameWindow = frameWindowRef.current;
    if (!frameWindow) return;

    frameWindow.scrollTo({ top: 0, left: 0 });
    setViewportScrollTop(0);
  }, [viewMode, viewportPresetId]);

  useEffect(() => {
    if (!fitMode) return;

    const viewport = viewportRef.current;

    if (!viewport) return;

    updateFitScale();

    const observer = new ResizeObserver(() => {
      updateFitScale();
    });

    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, [fitMode, updateFitScale]);

  useEffect(() => {
    let scheduledFrame = 0;

    const updateSelectionUiSuppression = () => {
      const nextSuppressed =
        hasBlockingEditorOverlay(document) ||
        hasBlockingEditorMenuFocus(document.activeElement);

      setSelectionUiSuppressed((current) =>
        current === nextSuppressed ? current : nextSuppressed,
      );

      document.body.classList.toggle(
        'tresh-selection-ui-suppressed',
        nextSuppressed,
      );
    };

    const scheduleSelectionUiUpdate = () => {
      window.cancelAnimationFrame(scheduledFrame);
      scheduledFrame = window.requestAnimationFrame(
        updateSelectionUiSuppression,
      );
    };

    updateSelectionUiSuppression();

    const observer = new MutationObserver(
      scheduleSelectionUiUpdate,
    );

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'open',
        'aria-expanded',
        'aria-hidden',
        'hidden',
      ],
    });

    document.addEventListener(
      'focusin',
      scheduleSelectionUiUpdate,
    );
    document.addEventListener(
      'focusout',
      scheduleSelectionUiUpdate,
    );

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(scheduledFrame);
      document.removeEventListener(
        'focusin',
        scheduleSelectionUiUpdate,
      );
      document.removeEventListener(
        'focusout',
        scheduleSelectionUiUpdate,
      );
      document.body.classList.remove(
        'tresh-selection-ui-suppressed',
      );
    };
  }, []);

  useEffect(() => {
    document.title = page
      ? `${page.title} — ${state.document.branding.title}`
      : state.document.branding.title;

    const selector = 'link[data-tresh-preview-favicon]';
    let favicon = document.head.querySelector<HTMLLinkElement>(selector);

    if (!state.document.branding.faviconUrl) {
      favicon?.remove();
      return;
    }

    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.dataset.treshPreviewFavicon = 'true';
      document.head.append(favicon);
    }

    favicon.href = state.document.branding.faviconUrl;
  }, [
    page,
    state.document.branding.faviconUrl,
    state.document.branding.title,
  ]);

  useEffect(() => {
    const frame = frameRef.current;

    if (
      !frame ||
      selectionUiSuppressed ||
      !state.selectedId ||
      editingId === state.selectedId
    ) {
      setTarget(null);
      return;
    }

    const nextTarget = frame.querySelector<HTMLElement>(
      `[data-element-id="${state.selectedId}"]`,
    );

    setTarget(nextTarget);
  }, [
    state.selectedId,
    state.document,
    state.breakpoint,
    editingId,
    scale,
    selectionUiSuppressed,
  ]);

  const selectedElement = state.selectedId
    ? findElement(state.document, state.selectedId)
    : undefined;

  const selectedPlacement = selectedElement
    ? resolvePlacement(
        selectedElement.placement,
        state.breakpoint,
      )
    : undefined;

  const movableSelectionCount = state.selectedIds.reduce(
    (count, elementId) => {
      const element = findElement(state.document, elementId);
      return count + (element && !element.locked ? 1 : 0);
    },
    0,
  );

  const applySelectionLayout = (
    command: SelectionLayoutCommand,
  ) => {
    const frame = frameRef.current;
    if (!frame) return;

    const boxes: SelectionBox[] = [];
    let commonSection: HTMLElement | null = null;

    for (const elementId of state.selectedIds) {
      const element = findElement(
        state.document,
        elementId,
      );

      if (!element || element.locked) continue;

      const targetElement =
        frame.querySelector<HTMLElement>(
          `[data-element-id="${elementId}"]`,
        );

      const sectionElement =
        targetElement?.closest<HTMLElement>(
          '[data-section-id]',
        );

      if (!targetElement || !sectionElement) continue;

      if (commonSection && commonSection !== sectionElement) {
        return;
      }

      commonSection = sectionElement;

      const targetRect =
        targetElement.getBoundingClientRect();
      const sectionRect =
        sectionElement.getBoundingClientRect();

      if (
        sectionRect.width <= 0 ||
        sectionRect.height <= 0
      ) {
        continue;
      }

      const left =
        ((targetRect.left - sectionRect.left) /
          sectionRect.width) *
        100;
      const top =
        ((targetRect.top - sectionRect.top) /
          sectionRect.height) *
        100;
      const width =
        (targetRect.width / sectionRect.width) * 100;
      const height =
        (targetRect.height / sectionRect.height) * 100;

      boxes.push({
        id: elementId,
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
      });
    }

    if (boxes.length < 2) return;

    dispatch({
      type: 'selection/patches',
      patches: layoutSelection(boxes, command),
    });
  };

  // TRESH_MOVEABLE_EXTERNAL_SYNC
  useEffect(() => {
    if (
      !target ||
      !selectedPlacement ||
      interactionRef.current
    ) {
      return;
    }

    const handle = window.requestAnimationFrame(() => {
      moveableRef.current?.updateRect();
    });

    return () => {
      window.cancelAnimationFrame(handle);
    };
  }, [
    target,
    scale,
    selectedPlacement?.xPercent,
    selectedPlacement?.yPercent,
    selectedPlacement?.widthPercent,
    selectedPlacement?.heightPercent,
    selectedPlacement?.rotationDegrees,
    viewportScrollTop,
    viewMode,
  ]);
  const startInteraction = () => {
    if (!selectedElement || !target) return;

    const section = target.closest<HTMLElement>(
      '[data-section-id]',
    );

    if (!section) return;

    interactionPatchRef.current = {};
    groupPatchRef.current = {};

    interactionRef.current = {
      placement: resolvePlacement(
        selectedElement.placement,
        state.breakpoint,
      ),
      sectionWidth: section.clientWidth,
      sectionHeight: section.clientHeight,
    };

    const frame = frameRef.current;
    groupDragRef.current = frame
      ? state.selectedIds
          .map((elementId): GroupDragEntry | null => {
            const element = findElement(
              state.document,
              elementId,
            );

            if (!element || element.locked) return null;

            const elementTarget =
              frame.querySelector<HTMLElement>(
                `[data-element-id="${elementId}"]`,
              );
            const elementSection =
              elementTarget?.closest<HTMLElement>(
                '[data-section-id]',
              );

            if (
              !elementTarget ||
              !elementSection ||
              elementSection !== section
            ) {
              return null;
            }

            return {
              id: elementId,
              target: elementTarget,
              placement: resolvePlacement(
                element.placement,
                state.breakpoint,
              ),
              sectionWidth: elementSection.clientWidth,
              sectionHeight: elementSection.clientHeight,
            };
          })
          .filter(
            (entry): entry is GroupDragEntry =>
              entry !== null,
          )
      : [];

    dispatch({ type: 'interaction/start' });
  };

  const previewInteraction = (patch: Partial<Placement>) => {
    const start = interactionRef.current;

    if (!target || !start) return;

    interactionPatchRef.current = {
      ...interactionPatchRef.current,
      ...patch,
    };

    const previewPlacement = {
      ...start.placement,
      ...interactionPatchRef.current,
    };

    target.style.left = `${previewPlacement.xPercent}%`;
    target.style.top = `${previewPlacement.yPercent}%`;
    target.style.width = `${previewPlacement.widthPercent}%`;

    if (previewPlacement.heightPercent !== undefined) {
      target.style.height = `${previewPlacement.heightPercent}%`;
    }

    target.style.transform =
      `translate(-50%, -50%) rotate(${previewPlacement.rotationDegrees}deg)`;
  };

  const previewDrag = (
    deltaX: number,
    deltaY: number,
  ) => {
    const entries = groupDragRef.current;

    if (entries.length <= 1) {
      const start = interactionRef.current;
      if (!start) return;

      previewInteraction({
        xPercent: clamp(
          start.placement.xPercent +
            (deltaX / start.sectionWidth) * 100,
          0,
          100,
        ),
        yPercent: clamp(
          start.placement.yPercent +
            (deltaY / start.sectionHeight) * 100,
          0,
          100,
        ),
      });
      return;
    }

    const patches: SelectionPlacementPatches = {};

    for (const entry of entries) {
      const xPercent = clamp(
        entry.placement.xPercent +
          (deltaX / entry.sectionWidth) * 100,
        0,
        100,
      );
      const yPercent = clamp(
        entry.placement.yPercent +
          (deltaY / entry.sectionHeight) * 100,
        0,
        100,
      );

      entry.target.style.left = `${xPercent}%`;
      entry.target.style.top = `${yPercent}%`;
      patches[entry.id] = { xPercent, yPercent };
    }

    groupPatchRef.current = patches;
  };

  const endInteraction = () => {
    const patch = interactionPatchRef.current;
    const groupPatches = groupPatchRef.current;
    const elementId = selectedElement?.id;

    interactionPatchRef.current = {};
    groupPatchRef.current = {};
    groupDragRef.current = [];
    interactionRef.current = null;

    if (Object.keys(groupPatches).length > 1) {
      dispatch({
        type: 'selection/patches',
        patches: groupPatches,
        live: true,
      });
    } else if (
      elementId &&
      Object.keys(patch).length > 0
    ) {
      dispatch({
        type: 'placement/patch',
        elementId,
        patch,
        live: true,
      });
    }

    dispatch({ type: 'interaction/end' });

    // TRESH_MOVEABLE_FINAL_SYNC
    window.requestAnimationFrame(() => {
      moveableRef.current?.updateRect();
    });
  };

  useEffect(() => {
    const clearPaletteDropTarget = () => {
      setPaletteDropSectionId(null);
      setExternalMediaDropSectionId(null);
    };

    window.addEventListener(
      PALETTE_DRAG_END_EVENT,
      clearPaletteDropTarget,
    );

    return () => {
      window.removeEventListener(
        PALETTE_DRAG_END_EVENT,
        clearPaletteDropTarget,
      );
    };
  }, []);

  const findCanvasDropSection = (
    clientX: number,
    clientY: number,
  ): HTMLElement | null => {
    const frame = frameRef.current;
    if (!frame) return null;

    const sections = Array.from(
      frame.querySelectorAll<HTMLElement>(
        '[data-section-id]',
      ),
    );

    return (
      sections.find((section) => {
        const bounds = section.getBoundingClientRect();

        return (
          clientX >= bounds.left &&
          clientX <= bounds.right &&
          clientY >= bounds.top &&
          clientY <= bounds.bottom
        );
      }) ?? null
    );
  };

  const clearCanvasDropTargets = () => {
    setPaletteDropSectionId(null);
    setExternalMediaDropSectionId(null);
  };

  const handleCanvasDragOver = (
    event: ReactDragEvent<HTMLDivElement>,
  ) => {
    const paletteTransfer = hasPaletteToolTransfer(
      event.dataTransfer.types,
    );
    const externalFileTransfer = hasExternalFileTransfer(
      event.dataTransfer.types,
    );

    if (!paletteTransfer && !externalFileTransfer) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';

    const section = findCanvasDropSection(
      event.clientX,
      event.clientY,
    );
    const sectionId = section?.dataset.sectionId ?? null;

    if (paletteTransfer) {
      setPaletteDropSectionId(sectionId);
      setExternalMediaDropSectionId(null);
      return;
    }

    setPaletteDropSectionId(null);
    setExternalMediaDropSectionId(sectionId);
  };

  const handleCanvasDragLeave = (
    event: ReactDragEvent<HTMLDivElement>,
  ) => {
    const relatedTarget = event.relatedTarget;

    if (
      relatedTarget instanceof Node &&
      event.currentTarget.contains(relatedTarget)
    ) {
      return;
    }

    clearCanvasDropTargets();
  };

  const addPaletteElementFromDrop = (
    event: ReactDragEvent<HTMLDivElement>,
    section: HTMLElement,
    sectionId: string,
  ) => {
    const toolId = event.dataTransfer.getData(
      PALETTE_TOOL_MIME,
    );

    if (!isPaletteToolId(toolId)) {
      return;
    }

    const element = createElementForTool(
      toolId,
      sectionId,
    );

    if (!element) {
      return;
    }

    const positionedElement = placePaletteElementAtPoint(
      element,
      state.breakpoint,
      {
        clientX: event.clientX,
        clientY: event.clientY,
      },
      section.getBoundingClientRect(),
    );

    dispatch({
      type: 'element/add',
      element: positionedElement,
    });
  };

  const addExternalMediaFromDrop = async (
    file: File,
    sectionId: string,
    point: {
      clientX: number;
      clientY: number;
    },
    sectionRect: DOMRect,
  ) => {
    const fingerprint = externalMediaFingerprint(file);
    const now = Date.now();
    const recentDrop = recentExternalMediaDropRef.current;

    if (externalMediaUploadBusyRef.current) {
      showExternalMediaFeedback({
        kind: 'uploading',
        message: 'Une image est déjà en cours d’importation.',
      });
      return;
    }

    if (
      recentDrop?.fingerprint === fingerprint &&
      now - recentDrop.at <
        EXTERNAL_MEDIA_DUPLICATE_WINDOW_MS
    ) {
      return;
    }

    externalMediaUploadBusyRef.current = true;
    recentExternalMediaDropRef.current = {
      fingerprint,
      at: now,
    };

    const dropBreakpoint = state.breakpoint;

    showExternalMediaFeedback({
      kind: 'uploading',
      message: `Import de ${file.name}…`,
    });

    try {
      const uploaded = await uploadSiteMedia(file);
      const element = createUploadedImageElement(
        sectionId,
        uploaded.publicUrl,
        uploaded.aspectRatio,
        uploaded.fileName,
      );
      const positionedElement = placePaletteElementAtPoint(
        element,
        dropBreakpoint,
        point,
        sectionRect,
      );

      dispatch({
        type: 'element/add',
        element: positionedElement,
      });

      showExternalMediaFeedback({
        kind: 'success',
        message: `${uploaded.fileName} importé et placé.`,
      });
    } catch (error: unknown) {
      showExternalMediaFeedback({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Impossible d’importer cette image.',
      });
    } finally {
      externalMediaUploadBusyRef.current = false;
    }
  };

  const handleCanvasDrop = (
    event: ReactDragEvent<HTMLDivElement>,
  ) => {
    const paletteTransfer = hasPaletteToolTransfer(
      event.dataTransfer.types,
    );
    const externalFileTransfer = hasExternalFileTransfer(
      event.dataTransfer.types,
    );

    if (!paletteTransfer && !externalFileTransfer) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const section = findCanvasDropSection(
      event.clientX,
      event.clientY,
    );
    const sectionId = section?.dataset.sectionId;

    if (!section || !sectionId) {
      clearCanvasDropTargets();

      if (externalFileTransfer) {
        showExternalMediaFeedback({
          kind: 'error',
          message: 'Dépose l’image dans une section visible.',
        });
      }

      return;
    }

    if (paletteTransfer) {
      addPaletteElementFromDrop(
        event,
        section,
        sectionId,
      );
      clearCanvasDropTargets();
      return;
    }

    const selection = selectExternalMediaFile<File>(
      event.dataTransfer.files,
    );

    if (!selection.file) {
      clearCanvasDropTargets();
      showExternalMediaFeedback({
        kind: 'error',
        message: selection.error,
      });
      return;
    }

    const point = {
      clientX: event.clientX,
      clientY: event.clientY,
    };
    const sectionRect = section.getBoundingClientRect();

    clearCanvasDropTargets();

    void addExternalMediaFromDrop(
      selection.file,
      sectionId,
      point,
      sectionRect,
    );
  };

  const handleCanvasWheel = (
    event: ReactWheelEvent<HTMLDivElement>,
  ) => {
    if (!event.ctrlKey && !event.metaKey) return;

    event.preventDefault();

    const direction =
      event.deltaY < 0
        ? ZOOM_STEP_PERCENT
        : -ZOOM_STEP_PERCENT;

    setManualZoom(zoomPercent + direction);
  };

  const selectViewMode = (nextMode: CanvasViewMode) => {
    setViewMode(nextMode);

    if (nextMode === 'viewport') {
      const preset = getViewportPreset(viewportPresetId);

      if (preset.breakpoint !== state.breakpoint) {
        dispatch({
          type: 'breakpoint/set',
          breakpoint: preset.breakpoint,
        });
      }
    }
  };

  const selectViewportPreset = (
    nextPresetId: ViewportPresetId,
  ) => {
    const preset = getViewportPreset(nextPresetId);

    setViewportPresetId(nextPresetId);

    if (preset.breakpoint !== state.breakpoint) {
      dispatch({
        type: 'breakpoint/set',
        breakpoint: preset.breakpoint,
      });
    }
  };

  const handleFrameWindowScroll = () => {
    const frameWindow = frameWindowRef.current;
    if (!frameWindow || viewMode !== 'viewport') return;

    setViewportScrollTop(
      Math.round(frameWindow.scrollTop / Math.max(scale, 0.01)),
    );

    window.requestAnimationFrame(() => {
      moveableRef.current?.updateRect();
    });
  };

  const fixedRatioShape =
    selectedElement?.type === 'shape' &&
    FIXED_RATIO_SHAPES.includes(selectedElement.shapeKind);

  return (
    <main
      className="stage"
      aria-label="Aperçu visuel du site"
    >
      <div
        className="canvas-toolbar"
        role="toolbar"
        aria-label="Contrôles du zoom"
      >
        <div
          className="canvas-view-mode-toggle"
          role="group"
          aria-label="Mode d’affichage du canevas"
        >
          <button
            type="button"
            className={viewMode === 'page' ? 'is-active' : ''}
            aria-pressed={viewMode === 'page'}
            onClick={() => selectViewMode('page')}
          >
            Page
          </button>
          <button
            type="button"
            className={viewMode === 'viewport' ? 'is-active' : ''}
            aria-pressed={viewMode === 'viewport'}
            onClick={() => selectViewMode('viewport')}
          >
            Écran
          </button>
        </div>

        {viewMode === 'viewport' && (
          <>
            <select
              className="viewport-preset-select"
              aria-label="Format d’écran"
              value={viewportPresetId}
              onChange={(event) =>
                selectViewportPreset(
                  event.currentTarget.value as ViewportPresetId,
                )
              }
            >
              {VIEWPORT_PRESETS.map((preset) => (
                <option value={preset.id} key={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            <output className="viewport-preset-size">
              {viewportPreset.width} × {viewportPreset.height}
            </output>
          </>
        )}

        <span
          className="canvas-toolbar__divider"
          aria-hidden="true"
        />

        <button
          type="button"
          className="canvas-toolbar__button"
          aria-label="Réduire le zoom"
          title="Réduire le zoom"
          disabled={zoomPercent <= MIN_ZOOM_PERCENT}
          onClick={() =>
            setManualZoom(
              zoomPercent - ZOOM_STEP_PERCENT,
            )
          }
        >
          −
        </button>

        <input
          className="canvas-zoom-slider"
          type="range"
          min={MIN_ZOOM_PERCENT}
          max={MAX_ZOOM_PERCENT}
          step={1}
          value={zoomPercent}
          aria-label="Niveau de zoom"
          onChange={(event) =>
            setManualZoom(
              Number(event.currentTarget.value),
            )
          }
        />

        <output
          className="canvas-zoom-value"
          aria-live="polite"
        >
          {zoomPercent} %
        </output>

        <button
          type="button"
          className="canvas-toolbar__button"
          aria-label="Augmenter le zoom"
          title="Augmenter le zoom"
          disabled={zoomPercent >= MAX_ZOOM_PERCENT}
          onClick={() =>
            setManualZoom(
              zoomPercent + ZOOM_STEP_PERCENT,
            )
          }
        >
          +
        </button>

        <span
          className="canvas-toolbar__divider"
          aria-hidden="true"
        />

        <button
          type="button"
          className="canvas-toolbar__button canvas-toolbar__button--text"
          onClick={() => setManualZoom(100)}
        >
          100 %
        </button>

        <button
          type="button"
          className={`canvas-toolbar__button canvas-toolbar__button--text ${
            fitMode ? 'is-active' : ''
          }`}
          aria-pressed={fitMode}
          onClick={enableFitMode}
        >
          Ajuster
        </button>

        <button
          type="button"
          className={`canvas-toolbar__button canvas-toolbar__button--text ${
            debugOpen ? 'is-active' : ''
          }`}
          aria-pressed={debugOpen}
          onClick={() => setDebugOpen((current) => !current)}
        >
          Diagnostic
        </button>

        {state.selectedIds.length > 1 && (
          <>
            <span
              className="canvas-toolbar__divider"
              aria-hidden="true"
            />
            <div
              className="selection-layout-toolbar"
              role="group"
              aria-label="Alignement de la sélection"
            >
              <span>
                {state.selectedIds.length} sélectionnés
              </span>
              {SELECTION_LAYOUT_ACTIONS.map((action) => (
                <button
                  type="button"
                  className="canvas-toolbar__button selection-layout-button"
                  disabled={movableSelectionCount < 2}
                  title={action.label}
                  aria-label={action.label}
                  onClick={() =>
                    applySelectionLayout(action.command)
                  }
                  key={action.command}
                >
                  {action.glyph}
                </button>
              ))}
            </div>
          </>
        )}

        <span className="canvas-toolbar__hint">
          Ctrl + molette
        </span>
      </div>

      <div
        className="canvas-viewport"
        ref={viewportRef}
        onWheel={handleCanvasWheel}
      >
        <div className="canvas-surface">
          <div
            className={`frame-wrap frame-wrap--${viewMode}`}
            style={{
              width: frameWidth * scale,
              height: visibleFrameHeight * scale,
            }}
          >
            <span className="frame-label">
              {viewMode === 'viewport'
                ? `${viewportPreset.label} · ${frameWidth} × ${viewportPreset.height} px · ${zoomPercent} %`
                : `${frameWidth} px · page complète · ${zoomPercent} %`}
              {fitMode ? ' · ajusté' : ''}
            </span>

            <div
              className={`frame-window ${viewMode === 'viewport' ? 'is-viewport' : 'is-page'}`}
              ref={frameWindowRef}
              style={{
                width: frameWidth * scale,
                height: visibleFrameHeight * scale,
              }}
              onScroll={handleFrameWindowScroll}
              onDragOver={handleCanvasDragOver}
              onDragLeave={handleCanvasDragLeave}
              onDrop={handleCanvasDrop}
            >
              <div
                className="frame-scroll-content"
                style={{
                  width: frameWidth * scale,
                  height: totalHeight * scale,
                }}
              >
                <div
                  className="site-frame"
                  ref={frameRef}
                  style={{
                    width: frameWidth,
                    minHeight: totalHeight,
                    transform: `scale(${scale})`,
                  }}
                >
                  <SiteNavbarPreview
                    navigation={state.document.navigation}
                    breakpoint={state.breakpoint}
                  />

                  {visibleSections.map((section) => (
                    <CanvasSection
                      section={section}
                      selectedId={state.selectedId}
                      selectedIds={state.selectedIds}
                      editingId={editingId}
                      paletteDropActive={
                        paletteDropSectionId === section.id
                      }
                      externalMediaDropActive={
                        externalMediaDropSectionId === section.id
                      }
                      onActivate={() =>
                        dispatch({
                          type: 'section/activate',
                          sectionId: section.id,
                        })
                      }
                      onSelectElement={(element, additive) =>
                        dispatch({
                          type: 'element/select',
                          elementId: element.id,
                          sectionId: element.sectionId,
                          additive,
                        })
                      }
                      onEditElement={(elementId) => {
                        dispatch({
                          type: 'element/select',
                          elementId,
                          sectionId: section.id,
                        });

                        setEditingId(elementId);
                      }}
                      onTextCommit={(elementId, value) => {
                        dispatch({
                          type: 'element/update',
                          elementId,
                          updater: (element) =>
                            element.type === 'text'
                              ? {
                                  ...element,
                                  text: {
                                    ...element.text,
                                    'fr-CA': value,
                                  },
                                }
                              : element,
                        });

                        setEditingId(null);
                      }}
                      key={section.id}
                    />
                  ))}

                  <SiteFooterPreview
                    footer={state.document.footer}
                    breakpoint={state.breakpoint}
                  />
                </div>

                {!selectionUiSuppressed &&
                  target &&
                  selectedElement &&
                  selectedPlacement &&
                  !selectedElement.locked && (
                    <Moveable
                      ref={(instance) => {
                        moveableRef.current = instance;
                      }}
                      key={`${selectedElement.id}-${state.selectedIds.join('-')}-${scale}`}
                      target={target}
                      rootContainer={document.body}
                      flushSync={flushSync}
                      useAccuratePosition
                      draggable
                      resizable={state.selectedIds.length === 1}
                      rotatable={state.selectedIds.length === 1}
                      keepRatio={
                        selectedElement.type === 'paint' ||
                        fixedRatioShape
                      }
                      origin={false}
                      edge
                      throttleDrag={0}
                      throttleResize={0}
                      throttleRotate={1}
                      onDragStart={startInteraction}
                      onDrag={(event) => {
                        const [
                          deltaX = 0,
                          deltaY = 0,
                        ] = event.beforeDist;

                        previewDrag(deltaX, deltaY);
                      }}
                      onDragEnd={endInteraction}
                      onResizeStart={startInteraction}
                      onResize={(event) => {
                        const start = interactionRef.current;

                        if (!start) return;

                        const [
                          dragX = 0,
                          dragY = 0,
                        ] = event.drag.beforeDist;

                        const patch: Partial<Placement> = {
                          widthPercent: clamp(
                            (event.width /
                              start.sectionWidth) *
                              100,
                            4,
                            100,
                          ),
                          xPercent: clamp(
                            start.placement.xPercent +
                              (dragX /
                                start.sectionWidth) *
                                100,
                            0,
                            100,
                          ),
                          yPercent: clamp(
                            start.placement.yPercent +
                              (dragY /
                                start.sectionHeight) *
                                100,
                            0,
                            100,
                          ),
                        };

                        if (
                          (selectedElement.type === 'shape' &&
                            !fixedRatioShape) ||
                          selectedElement.type === 'image'
                        ) {
                          patch.heightPercent = clamp(
                            (event.height / start.sectionHeight) * 100,
                            1,
                            100,
                          );
                        }

                        previewInteraction(patch);
                      }}
                      onResizeEnd={endInteraction}
                      onRotateStart={startInteraction}
                      onRotate={(event) =>
                        previewInteraction({
                          rotationDegrees:
                            event.beforeRotate,
                        })
                      }
                      onRotateEnd={endInteraction}
                    />
                  )}
              </div>
            </div>

            {viewMode === 'viewport' && (
              <>
                <span className="viewport-fold-label">
                  PLI · {viewportPreset.height} px
                </span>
                <span className="viewport-scroll-status">
                  scroll {Math.min(viewportScrollTop, viewportScrollMaximum)} /
                  {' '}{viewportScrollMaximum} px
                </span>
              </>
            )}

            {!selectionUiSuppressed &&
              selectedPlacement &&
              selectedElement &&
              target && (
                <div
                  className="selection-hud"
                  role="status"
                >
                  {state.selectedIds.length > 1 && (
                    <>
                      {state.selectedIds.length} éléments ·{' '}
                    </>
                  )}
                  x{' '}
                  {selectedPlacement.xPercent.toFixed(
                    1,
                  )}
                  % · y{' '}
                  {selectedPlacement.yPercent.toFixed(
                    1,
                  )}
                  % · w{' '}
                  {selectedPlacement.widthPercent.toFixed(
                    1,
                  )}
                  % · rot{' '}
                  {Math.round(
                    selectedPlacement.rotationDegrees,
                  )}
                  °
                </div>
              )}
          </div>
        </div>
      </div>

      {externalMediaFeedback && (
        <div
          className={`external-media-feedback is-${externalMediaFeedback.kind}`}
          role={
            externalMediaFeedback.kind === 'error'
              ? 'alert'
              : 'status'
          }
          aria-live="polite"
        >
          <span className="external-media-feedback__icon" aria-hidden="true">
            {externalMediaFeedback.kind === 'uploading'
              ? '↥'
              : externalMediaFeedback.kind === 'success'
                ? '✓'
                : '!'}
          </span>
          <span>{externalMediaFeedback.message}</span>
        </div>
      )}

      <CanvasDiagnostics
        open={debugOpen}
        onClose={() => setDebugOpen(false)}
        zoomPercent={zoomPercent}
        fitMode={fitMode}
        scale={scale}
        frameWidth={frameWidth}
        totalHeight={totalHeight}
        breakpoint={state.breakpoint}
        viewportRef={viewportRef}
        frameRef={frameRef}
        target={target}
        selectedElement={selectedElement}
        selectedPlacement={selectedPlacement}
      />
    </main>
  );
}
