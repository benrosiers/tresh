import { findSection } from '../model/documentOps';
import type { SceneElement } from '../model/siteDocument';
import { createElementForTool, useEditor } from '../state/editorStore';
import { elementLabel, elementSwatch } from './editorConstants';

const tools = [
  { id: 'heading', label: 'Titre', glyph: 'Aa' },
  { id: 'text', label: 'Texte', glyph: '¶' },
  { id: 'button', label: 'Bouton', glyph: '▭' },
  { id: 'image', label: 'Image', glyph: '▨' },
  { id: 'paint', label: 'Peinture', glyph: '◐' },
  { id: 'shape', label: 'Forme', glyph: '◯' },
  { id: 'section', label: 'Section', glyph: '▤' },
] as const;

function toggleElement(element: SceneElement, property: 'visible' | 'locked'): SceneElement {
  return { ...element, [property]: !element[property] };
}

export function LeftRail() {
  const { state, dispatch } = useEditor();
  const section = findSection(state.document, state.activeSectionId);

  const addTool = (tool: (typeof tools)[number]['id']) => {
    if (tool === 'section') {
      const sectionId = `section-${crypto.randomUUID().slice(0, 6)}`;
      dispatch({ type: 'section/add', sectionId, label: 'Nouvelle section' });
      return;
    }

    const element = createElementForTool(tool, state.activeSectionId);
    if (element) dispatch({ type: 'element/add', element });
  };

  return (
    <aside className="rail rail--left" aria-label="Éléments et calques">
      <h2 className="rail-title">Éléments</h2>
      <div className="tool-grid">
        {tools.map((tool) => (
          <button type="button" className="tool-card" onClick={() => addTool(tool.id)} key={tool.id}>
            <span className="tool-card__glyph" aria-hidden="true">{tool.glyph}</span>
            {tool.label}
          </button>
        ))}
      </div>

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

      <h2 className="rail-title">Calques — {section?.label ?? 'Section'}</h2>
      <div className="layer-list">
        {(section?.scene ?? [])
          .slice()
          .sort((a, b) => b.placement.desktop.zIndex - a.placement.desktop.zIndex)
          .map((element) => (
            <div
              className={`layer-row ${state.selectedId === element.id ? 'is-selected' : ''}`}
              key={element.id}
            >
              <button
                type="button"
                className="layer-row__select"
                onClick={() =>
                  dispatch({ type: 'element/select', elementId: element.id, sectionId: element.sectionId })
                }
              >
                <span className="layer-swatch" style={{ background: elementSwatch(element) }} />
                <span className="layer-name">{elementLabel(element)}</span>
              </button>
              <button
                type="button"
                className={`icon-button ${element.visible ? '' : 'is-off'}`}
                aria-label={element.visible ? 'Masquer le calque' : 'Afficher le calque'}
                onClick={() =>
                  dispatch({
                    type: 'element/update',
                    elementId: element.id,
                    updater: (current) => toggleElement(current, 'visible'),
                  })
                }
              >
                {element.visible ? '●' : '○'}
              </button>
              <button
                type="button"
                className={`icon-button ${element.locked ? 'is-locked' : ''}`}
                aria-label={element.locked ? 'Déverrouiller le calque' : 'Verrouiller le calque'}
                onClick={() =>
                  dispatch({
                    type: 'element/update',
                    elementId: element.id,
                    updater: (current) => toggleElement(current, 'locked'),
                  })
                }
              >
                {element.locked ? '◆' : '◇'}
              </button>
            </div>
          ))}
      </div>
    </aside>
  );
}