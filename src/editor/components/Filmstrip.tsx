import { getPage } from '../model/documentOps';
import { useEditor } from '../state/editorStore';

const sectionColors = ['#E98B5F', '#F2C79A', '#E8A0B0', '#D8CBB8', '#C9C2B4', '#7F8897'];

export function Filmstrip() {
  const { state, dispatch } = useEditor();
  const page = getPage(state.document, state.pageId);

  return (
    <footer className="filmstrip" aria-label="Sections de la page">
      <span className="filmstrip__label">Sections</span>
      {page?.sections.map((section, index) => {
        const canDelete = page.sections.length > 1;
        return (
          <div
            className={`section-card ${state.activeSectionId === section.id ? 'is-current' : ''}`}
            key={section.id}
          >
            <button
              type="button"
              className="section-card__main"
              onClick={() => dispatch({ type: 'section/activate', sectionId: section.id })}
            >
              <span
                className="section-card__swatch"
                style={{ background: sectionColors[index % sectionColors.length], opacity: section.visible ? 1 : 0.3 }}
              />
              <span className="section-card__meta">
                <strong>{section.label}</strong>
                <small>{section.scene.length} éléments</small>
              </span>
            </button>
            <span className="section-card__moves">
              <button
                type="button"
                aria-label="Monter la section"
                disabled={index === 0}
                onClick={() => dispatch({ type: 'section/move', sectionId: section.id, direction: -1 })}
              >
                ▲
              </button>
              <button
                type="button"
                aria-label="Descendre la section"
                disabled={index === (page.sections.length - 1)}
                onClick={() => dispatch({ type: 'section/move', sectionId: section.id, direction: 1 })}
              >
                ▼
              </button>
            </span>
            <button
              type="button"
              className={`section-card__visibility ${section.visible ? '' : 'is-off'}`}
              aria-label={section.visible ? 'Masquer la section' : 'Afficher la section'}
              onClick={() => dispatch({ type: 'section/toggle', sectionId: section.id })}
            >
              {section.visible ? '●' : '○'}
            </button>
            <button
              type="button"
              className="section-card__delete"
              aria-label={`Supprimer la section ${section.label}`}
              title={canDelete ? 'Supprimer cette section' : 'La page doit conserver au moins une section'}
              disabled={!canDelete}
              onClick={() => {
                const elementLabel = section.scene.length === 1 ? '1 élément' : `${section.scene.length} éléments`;
                if (window.confirm(`Supprimer la section « ${section.label} » et ses ${elementLabel}?`)) {
                  dispatch({ type: 'section/remove', sectionId: section.id });
                }
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </footer>
  );
}
