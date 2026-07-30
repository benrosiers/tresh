import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import Moveable from 'react-moveable';
import { findElement, getPage, resolvePlacement } from '../model/documentOps';
import type { Placement, SceneElement, SectionDocument } from '../model/siteDocument';
import { useEditor } from '../state/editorStore';
import { FRAME_WIDTH, PAINT_COLORS } from './editorConstants';

interface InteractionStart {
  placement: Placement;
  sectionWidth: number;
  sectionHeight: number;
}

const MIN_ZOOM_PERCENT = 5;
const MAX_ZOOM_PERCENT = 200;
const ZOOM_STEP_PERCENT = 5;

const ZOOM_STORAGE_KEY = 'tresh.canvas.zoom-percent';
const FIT_STORAGE_KEY = 'tresh.canvas.fit-enabled';

const VIEWPORT_HORIZONTAL_PADDING = 72;
const VIEWPORT_VERTICAL_PADDING = 106;

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

function localized(element: Extract<SceneElement, { type: 'text' }>): string {
  return element.text['fr-CA'] ?? '';
}

function ElementNode({
  element,
  selected,
  editing,
  onSelect,
  onEdit,
  onTextCommit,
}: {
  element: SceneElement;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onTextCommit: (value: string) => void;
}) {
  const { state } = useEditor();
  const placement = resolvePlacement(element.placement, state.breakpoint);

  const commonStyle = {
    left: `${placement.xPercent}%`,
    top: `${placement.yPercent}%`,
    width: `${placement.widthPercent}%`,
    opacity: placement.opacity,
    zIndex: placement.zIndex,
    transform: `translate(-50%, -50%) rotate(${placement.rotationDegrees}deg)`,
  };

  const commonProps = {
    'data-element-id': element.id,
    className: `canvas-element canvas-element--${element.type} ${selected ? 'is-selected' : ''} ${element.locked ? 'is-locked' : ''}`,
    style: commonStyle,
    onPointerDown: (event: ReactPointerEvent) => {
      event.stopPropagation();
      onSelect();
    },
  };

  if (!element.visible) return null;

  if (element.type === 'paint') {
    return (
      <div {...commonProps} aria-label={`Peinture ${element.assetKey}`}>
        <div
          className="paint-blob"
          style={{ background: PAINT_COLORS[element.assetKey] }}
        />
      </div>
    );
  }

  if (element.type === 'image') {
    const source =
      element.source.kind === 'url'
        ? element.source.url
        : undefined;

    return (
      <div
        {...commonProps}
        style={{
          ...commonStyle,
          aspectRatio: '0.82',
        }}
      >
        {source ? (
          <img
            src={source}
            alt={element.altText['fr-CA'] ?? ''}
            style={{ borderRadius: element.cornerRadius }}
          />
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
        <span className={`site-button site-button--${element.variant}`}>
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
  editingId,
  onSelectElement,
  onEditElement,
  onTextCommit,
}: {
  section: SectionDocument;
  onActivate: () => void;
  selectedId: string | null;
  editingId: string | null;
  onSelectElement: (element: SceneElement) => void;
  onEditElement: (elementId: string) => void;
  onTextCommit: (elementId: string, value: string) => void;
}) {
  const { state } = useEditor();
  const height = section.height[state.breakpoint];

  return (
    <section
      className="site-section"
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
          selected={selectedId === element.id}
          editing={editingId === element.id}
          onSelect={() => onSelectElement(element)}
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
  const frameWidth = FRAME_WIDTH[state.breakpoint];

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<InteractionStart | null>(null);

  const [zoomPercent, setZoomPercent] = useState(readStoredZoom);
  const [fitMode, setFitMode] = useState(readStoredFitMode);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const scale = zoomPercent / 100;

  const visibleSections = useMemo(
    () => page?.sections.filter((section) => section.visible) ?? [],
    [page],
  );

  const totalHeight = visibleSections.reduce(
    (total, section) =>
      total + section.height[state.breakpoint],
    0,
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
      availableHeight / Math.max(totalHeight, 1);

    const nextPercent = clamp(
      Math.floor(
        Math.min(widthScale, heightScale) * 100,
      ),
      MIN_ZOOM_PERCENT,
      MAX_ZOOM_PERCENT,
    );

    setZoomPercent(nextPercent);
  }, [frameWidth, totalHeight]);

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
    const frame = frameRef.current;

    if (
      !frame ||
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

  const startInteraction = () => {
    if (!selectedElement || !target) return;

    const section = target.closest<HTMLElement>(
      '[data-section-id]',
    );

    if (!section) return;

    interactionRef.current = {
      placement: resolvePlacement(
        selectedElement.placement,
        state.breakpoint,
      ),
      sectionWidth: section.clientWidth,
      sectionHeight: section.clientHeight,
    };

    dispatch({ type: 'interaction/start' });
  };

  const livePatch = (patch: Partial<Placement>) => {
    if (!selectedElement) return;

    dispatch({
      type: 'placement/patch',
      elementId: selectedElement.id,
      patch,
      live: true,
    });
  };

  const endInteraction = () => {
    interactionRef.current = null;
    dispatch({ type: 'interaction/end' });
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
            className="frame-wrap"
            style={{
              width: frameWidth * scale,
              height: totalHeight * scale,
            }}
          >
            <span className="frame-label">
              {frameWidth} px · {zoomPercent} %
              {fitMode ? ' · ajusté' : ''}
            </span>

            <div
              className="site-frame"
              ref={frameRef}
              style={{
                width: frameWidth,
                minHeight: totalHeight,
                transform: `scale(${scale})`,
              }}
            >
              {visibleSections.map((section) => (
                <CanvasSection
                  section={section}
                  selectedId={state.selectedId}
                  editingId={editingId}
                  onActivate={() =>
                    dispatch({
                      type: 'section/activate',
                      sectionId: section.id,
                    })
                  }
                  onSelectElement={(element) =>
                    dispatch({
                      type: 'element/select',
                      elementId: element.id,
                      sectionId: element.sectionId,
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
            </div>

            {target &&
              selectedElement &&
              selectedPlacement &&
              !selectedElement.locked && (
                <Moveable
                  key={`${selectedElement.id}-${scale}`}
                  target={target}
                  draggable
                  resizable
                  rotatable
                  keepRatio={
                    selectedElement.type === 'paint' ||
                    selectedElement.type === 'image'
                  }
                  origin={false}
                  edge
                  throttleDrag={0}
                  throttleResize={0}
                  throttleRotate={1}
                  onDragStart={startInteraction}
                  onDrag={(event) => {
                    const start = interactionRef.current;

                    if (!start) return;

                    const [
                      deltaX = 0,
                      deltaY = 0,
                    ] = event.beforeTranslate;

                    livePatch({
                      xPercent: clamp(
                        start.placement.xPercent +
                          (deltaX / start.sectionWidth) *
                            100,
                        0,
                        100,
                      ),
                      yPercent: clamp(
                        start.placement.yPercent +
                          (deltaY / start.sectionHeight) *
                            100,
                        0,
                        100,
                      ),
                    });
                  }}
                  onDragEnd={endInteraction}
                  onResizeStart={startInteraction}
                  onResize={(event) => {
                    const start = interactionRef.current;

                    if (!start) return;

                    const [
                      dragX = 0,
                      dragY = 0,
                    ] = event.drag.beforeTranslate;

                    livePatch({
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
                    });
                  }}
                  onResizeEnd={endInteraction}
                  onRotateStart={startInteraction}
                  onRotate={(event) =>
                    livePatch({
                      rotationDegrees:
                        event.beforeRotate,
                    })
                  }
                  onRotateEnd={endInteraction}
                />
              )}

            {selectedPlacement &&
              selectedElement &&
              target && (
                <div
                  className="selection-hud"
                  role="status"
                >
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
    </main>
  );
}