import {
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { uploadSiteMedia } from '../../media/siteMedia';
import { findSection } from '../model/documentOps';
import {
  applyLayerOrder,
  dropLayerIds,
  getLayerStack,
  moveLayerIds,
  type LayerDropPosition,
  type LayerMove,
} from '../model/layerStack';
import {
  isPaletteToolId,
  PALETTE_DRAG_END_EVENT,
  PALETTE_TOOL_MIME,
  type PaletteToolId,
} from '../model/paletteDragDrop';
import type { SceneElement } from '../model/siteDocument';
import {
  createElementForTool,
  createUploadedImageElement,
  useEditor,
} from '../state/editorStore';
import { elementLabel, elementSwatch } from './editorConstants';
import { GlobalChromePanel } from './GlobalChromePanel';

const tools = [
  { id: 'heading', label: 'Titre', glyph: 'Aa' },
  { id: 'text', label: 'Texte', glyph: '¶' },
  { id: 'button', label: 'Bouton', glyph: '▭' },
  { id: 'image', label: 'Image', glyph: '▨' },
  { id: 'media', label: 'PNG / image', glyph: '⇧' },
  { id: 'paint', label: 'Peinture', glyph: '◐' },
  { id: 'shape', label: 'Forme', glyph: '◯' },
  { id: 'section', label: 'Section', glyph: '▤' },
] as const;

function toggleElement(element: SceneElement, property: 'visible' | 'locked'): SceneElement {
  return { ...element, [property]: !element[property] };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function LeftRail() {
  const { state, dispatch } = useEditor();
  const section = findSection(state.document, state.activeSectionId);
  const railRef = useRef<HTMLElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const suppressToolClickRef = useRef(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [draggedToolId, setDraggedToolId] =
    useState<PaletteToolId | null>(null);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    elementId: string;
    position: LayerDropPosition;
  } | null>(null);

  const layerStack = section
    ? getLayerStack(section.scene, state.breakpoint)
    : [];
  const orderedLayerIds = layerStack.map(
    (entry) => entry.element.id,
  );
  const tiedLayerCount = layerStack.filter(
    (entry) => entry.tied,
  ).length;

  const importMedia = async (file: File) => {
    setMediaBusy(true);
    setMediaError(null);

    try {
      const uploaded = await uploadSiteMedia(file);
      const element = createUploadedImageElement(
        state.activeSectionId,
        uploaded.publicUrl,
        uploaded.aspectRatio,
        uploaded.fileName,
      );

      dispatch({
        type: 'element/add',
        element,
      });
    } catch (error: unknown) {
      setMediaError(
        error instanceof Error
          ? error.message
          : 'Impossible d’importer cette image.',
      );
    } finally {
      setMediaBusy(false);
    }
  };

  const addTool = (tool: (typeof tools)[number]['id']) => {
    if (tool === 'media') {
      mediaInputRef.current?.click();
      return;
    }

    if (tool === 'section') {
      const sectionId = `section-${crypto.randomUUID().slice(0, 6)}`;
      dispatch({ type: 'section/add', sectionId, label: 'Nouvelle section' });
      return;
    }

    const element = createElementForTool(tool, state.activeSectionId);
    if (element) dispatch({ type: 'element/add', element });
  };

  const finishPaletteDrag = () => {
    setDraggedToolId(null);
    window.dispatchEvent(
      new Event(PALETTE_DRAG_END_EVENT),
    );

    window.setTimeout(() => {
      suppressToolClickRef.current = false;
    }, 0);
  };

  const startPaletteDrag = (
    event: DragEvent<HTMLButtonElement>,
    toolId: PaletteToolId,
  ) => {
    suppressToolClickRef.current = true;
    setDraggedToolId(toolId);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(PALETTE_TOOL_MIME, toolId);
    event.dataTransfer.setData(
      'text/plain',
      `tresh-tool:${toolId}`,
    );
  };

  const commitLayerOrder = (nextOrder: string[]) => {
    if (!section) return;

    dispatch({
      type: 'site/update',
      updater: (document) =>
        applyLayerOrder(
          document,
          section.id,
          state.breakpoint,
          nextOrder,
        ),
    });
  };

  const moveLayer = (
    elementId: string,
    move: LayerMove,
  ) => {
    commitLayerOrder(
      moveLayerIds(
        orderedLayerIds,
        elementId,
        move,
      ),
    );
  };

  const handleLayerDragStart = (
    event: DragEvent<HTMLDivElement>,
    element: SceneElement,
  ) => {
    const target = event.target as HTMLElement | null;

    if (target?.closest('[data-layer-no-drag="true"]')) {
      event.preventDefault();
      return;
    }

    if (!state.selectedIds.includes(element.id)) {
      dispatch({
        type: 'element/select',
        elementId: element.id,
        sectionId: element.sectionId,
      });
    }

    setDraggedLayerId(element.id);
    setDropTarget(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', element.id);
  };

  const autoScrollLayers = (clientY: number) => {
    const rail = railRef.current;
    if (!rail) return;

    const bounds = rail.getBoundingClientRect();
    const edgeSize = 64;
    const maximumStep = 24;

    if (clientY < bounds.top + edgeSize) {
      const ratio = clamp(
        (bounds.top + edgeSize - clientY) / edgeSize,
        0,
        1,
      );
      rail.scrollBy({
        top: -Math.ceil(maximumStep * ratio),
      });
      return;
    }

    if (clientY > bounds.bottom - edgeSize) {
      const ratio = clamp(
        (clientY - (bounds.bottom - edgeSize)) / edgeSize,
        0,
        1,
      );
      rail.scrollBy({
        top: Math.ceil(maximumStep * ratio),
      });
    }
  };

  const handleLayerDragOver = (
    event: DragEvent<HTMLDivElement>,
    elementId: string,
  ) => {
    event.preventDefault();
    autoScrollLayers(event.clientY);

    if (
      !draggedLayerId ||
      draggedLayerId === elementId
    ) {
      return;
    }

    const bounds =
      event.currentTarget.getBoundingClientRect();
    const position: LayerDropPosition =
      event.clientY < bounds.top + bounds.height / 2
        ? 'before'
        : 'after';

    event.dataTransfer.dropEffect = 'move';
    setDropTarget({ elementId, position });
  };

  const handleLayerDrop = (
    event: DragEvent<HTMLDivElement>,
    elementId: string,
  ) => {
    event.preventDefault();

    if (!draggedLayerId) return;

    const position =
      dropTarget?.elementId === elementId
        ? dropTarget.position
        : 'before';

    commitLayerOrder(
      dropLayerIds(
        orderedLayerIds,
        draggedLayerId,
        elementId,
        position,
      ),
    );

    setDraggedLayerId(null);
    setDropTarget(null);
  };

  return (
    <aside
      className="rail rail--left"
      aria-label="Éléments et calques"
      ref={railRef}
    >
      <h2 className="rail-title">Éléments</h2>

      <input
        ref={mediaInputRef}
        className="media-import-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';

          if (file) {
            void importMedia(file);
          }
        }}
      />

      <div className="tool-grid">
        {tools.map((tool) => {
          const draggable = isPaletteToolId(tool.id);

          return (
            <button
              type="button"
              className={[
                'tool-card',
                draggable ? 'is-draggable' : '',
                draggedToolId === tool.id ? 'is-dragging' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              draggable={draggable}
              disabled={mediaBusy && tool.id === 'media'}
              title={
                draggable
                  ? 'Cliquer pour ajouter au centre ou glisser sur le canevas'
                  : undefined
              }
              onClick={() => {
                if (suppressToolClickRef.current) {
                  suppressToolClickRef.current = false;
                  return;
                }

                addTool(tool.id);
              }}
              onDragStart={(event) => {
                if (!draggable) {
                  event.preventDefault();
                  return;
                }

                startPaletteDrag(event, tool.id);
              }}
              onDragEnd={finishPaletteDrag}
              key={tool.id}
            >
              <span
                className="tool-card__glyph"
                aria-hidden="true"
              >
                {tool.glyph}
              </span>
              {tool.label}
              {draggable && (
                <small className="tool-card__drag-hint">
                  glisser
                </small>
              )}
            </button>
          );
        })}
      </div>

      {mediaError && (
        <p className="media-import-error" role="alert">
          {mediaError}
        </p>
      )}

      <GlobalChromePanel />

      <h2 className="rail-title">Mode</h2>
      <div className="mode-toggle">
        <button
          type="button"
          className={state.mode === 'simple' ? 'is-active' : ''}
          onClick={() => dispatch({ type: 'mode/set', mode: 'simple' })}
        >
          Simple
        </button>
        <button
          type="button"
          className={state.mode === 'advanced' ? 'is-active' : ''}
          onClick={() => dispatch({ type: 'mode/set', mode: 'advanced' })}
        >
          Avancé
        </button>
      </div>

      <div className="layer-stack-heading">
        <h2 className="rail-title">
          Calques — {section?.label ?? 'Section'}
        </h2>
        <span>{state.breakpoint}</span>
      </div>

      <div className="layer-stack-legend" aria-hidden="true">
        <span>DEVANT ↑</span>
        <span>DERRIÈRE ↓</span>
      </div>

      {tiedLayerCount > 0 && (
        <p className="layer-stack-warning">
          <strong>=</strong> {tiedLayerCount} calque
          {tiedLayerCount > 1 ? 's' : ''} partage
          {tiedLayerCount > 1 ? 'nt' : ''} un niveau z.
          L’ordre affiché suit aussi l’ordre visuel du DOM.
        </p>
      )}

      {state.selectedIds.length > 1 && (
        <div className="multi-selection-summary" role="status">
          <strong>{state.selectedIds.length}</strong>
          <span>calques sélectionnés</span>
          <small>Shift+clic pour ajouter ou retirer</small>
        </div>
      )}

      <div className="layer-list">
        {layerStack.map((entry, index) => {
          const { element } = entry;
          const selected =
            state.selectedIds.includes(element.id);
          const primary =
            state.selectedId === element.id;
          const dragging = draggedLayerId === element.id;
          const dropBefore =
            dropTarget?.elementId === element.id &&
            dropTarget.position === 'before';
          const dropAfter =
            dropTarget?.elementId === element.id &&
            dropTarget.position === 'after';

          return (
            <div
              className={[
                'layer-row',
                selected ? 'is-selected' : '',
                primary ? 'is-primary-selected' : '',
                dragging ? 'is-dragging' : '',
                entry.tied ? 'has-tie' : '',
                dropBefore ? 'is-drop-before' : '',
                dropAfter ? 'is-drop-after' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              draggable
              title="Glisser la ligne pour changer l’ordre visuel"
              onDragStart={(event) =>
                handleLayerDragStart(event, element)
              }
              onDragOver={(event) =>
                handleLayerDragOver(event, element.id)
              }
              onDrop={(event) =>
                handleLayerDrop(event, element.id)
              }
              onDragEnd={() => {
                setDraggedLayerId(null);
                setDropTarget(null);
              }}
              key={element.id}
            >
              <button
                type="button"
                className="layer-row__drag"
                aria-label={`Déplacer ${elementLabel(element)}`}
                title="Toute la ligne peut être glissée"
                onClick={(event) =>
                  dispatch({
                    type: 'element/select',
                    elementId: element.id,
                    sectionId: element.sectionId,
                    additive: event.shiftKey,
                  })
                }
              >
                ⋮⋮
              </button>

              <button
                type="button"
                className="layer-row__select"
                onClick={(event) =>
                  dispatch({
                    type: 'element/select',
                    elementId: element.id,
                    sectionId: element.sectionId,
                    additive: event.shiftKey,
                  })
                }
              >
                <span className="layer-rank">
                  {entry.rank}
                </span>
                <span
                  className="layer-swatch"
                  style={{
                    background: elementSwatch(element),
                  }}
                />
                <span className="layer-name">
                  {elementLabel(element)}
                </span>
              </button>

              <span
                className={`layer-z ${entry.tied ? 'has-tie' : ''}`}
                title={
                  entry.tied
                    ? `z ${entry.zIndex} — niveau partagé`
                    : `z ${entry.zIndex}`
                }
              >
                z {entry.zIndex}
                {entry.tied ? ' =' : ''}
              </span>

              <button
                type="button"
                data-layer-no-drag="true"
                className={`icon-button ${element.visible ? '' : 'is-off'}`}
                aria-label={element.visible ? 'Masquer le calque' : 'Afficher le calque'}
                onClick={() =>
                  dispatch({
                    type: 'element/update',
                    elementId: element.id,
                    updater: (current) =>
                      toggleElement(current, 'visible'),
                  })
                }
              >
                {element.visible ? '●' : '○'}
              </button>

              <button
                type="button"
                data-layer-no-drag="true"
                className={`icon-button ${element.locked ? 'is-locked' : ''}`}
                aria-label={element.locked ? 'Déverrouiller le calque' : 'Verrouiller le calque'}
                onClick={() =>
                  dispatch({
                    type: 'element/update',
                    elementId: element.id,
                    updater: (current) =>
                      toggleElement(current, 'locked'),
                  })
                }
              >
                {element.locked ? '◆' : '◇'}
              </button>

              {(dropBefore || dropAfter) && (
                <span
                  className={`layer-drop-label ${
                    dropBefore ? 'is-before' : 'is-after'
                  }`}
                  aria-hidden="true"
                >
                  {dropBefore ? 'AU-DESSUS' : 'EN DESSOUS'}
                </span>
              )}

              {primary && (
                <div
                  className="layer-row__stack-controls"
                  data-layer-no-drag="true"
                  role="group"
                  aria-label="Actions du calque"
                >
                  <button
                    type="button"
                    title="Dupliquer le calque"
                    aria-label="Dupliquer le calque"
                    onClick={() =>
                      dispatch({
                        type: 'element/duplicate',
                        elementId: element.id,
                      })
                    }
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    disabled={index === 0}
                    title="Tout devant"
                    aria-label="Placer tout devant"
                    onClick={() =>
                      moveLayer(element.id, 'front')
                    }
                  >
                    ⇈
                  </button>
                  <button
                    type="button"
                    disabled={index === 0}
                    title="Avancer d’un niveau"
                    aria-label="Avancer d’un niveau"
                    onClick={() =>
                      moveLayer(element.id, 'forward')
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === layerStack.length - 1}
                    title="Reculer d’un niveau"
                    aria-label="Reculer d’un niveau"
                    onClick={() =>
                      moveLayer(element.id, 'backward')
                    }
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={index === layerStack.length - 1}
                    title="Tout derrière"
                    aria-label="Placer tout derrière"
                    onClick={() =>
                      moveLayer(element.id, 'back')
                    }
                  >
                    ⇊
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
