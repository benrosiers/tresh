import { useEffect, useState } from 'react';
import { findElement, resolvePlacement } from '../model/documentOps';
import type { Breakpoint, SceneElement } from '../model/siteDocument';
import { useEditor } from '../state/editorStore';
import { PAINT_COLORS } from './editorConstants';

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function RangeField({ label, value, min, max, step = 1, suffix = '', onChange }: RangeFieldProps) {
  const { dispatch } = useEditor();
  return (
    <label className="inspector-field">
      <span>
        {label}
        <output>{Number.isInteger(value) ? value : value.toFixed(2)}{suffix}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onFocus={() => dispatch({ type: 'interaction/start' })}
        onPointerDown={() => dispatch({ type: 'interaction/start' })}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        onPointerUp={() => dispatch({ type: 'interaction/end' })}
        onBlur={() => dispatch({ type: 'interaction/end' })}
      />
    </label>
  );
}

function PlainTextField({ element }: { element: Extract<SceneElement, { type: 'text' }> }) {
  const { dispatch } = useEditor();
  const value = element.text['fr-CA'] ?? '';
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value, element.id]);

  const commit = () => {
    if (draft === value) return;
    dispatch({
      type: 'element/update',
      elementId: element.id,
      updater: (current) =>
        current.type === 'text'
          ? { ...current, text: { ...current.text, 'fr-CA': draft } }
          : current,
    });
  };

  return (
    <label className="inspector-field">
      <span>Contenu</span>
      <textarea
        rows={4}
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
      />
    </label>
  );
}

function ButtonFields({ element }: { element: Extract<SceneElement, { type: 'button' }> }) {
  const { dispatch } = useEditor();
  const [label, setLabel] = useState(element.label['fr-CA'] ?? '');
  const [href, setHref] = useState(element.href);

  useEffect(() => {
    setLabel(element.label['fr-CA'] ?? '');
    setHref(element.href);
  }, [element]);

  const commit = () => {
    dispatch({
      type: 'element/update',
      elementId: element.id,
      updater: (current) =>
        current.type === 'button'
          ? { ...current, label: { ...current.label, 'fr-CA': label }, href }
          : current,
    });
  };

  return (
    <>
      <label className="inspector-field">
        <span>Libellé</span>
        <input value={label} onChange={(event) => setLabel(event.currentTarget.value)} onBlur={commit} />
      </label>
      <label className="inspector-field">
        <span>Lien</span>
        <input value={href} onChange={(event) => setHref(event.currentTarget.value)} onBlur={commit} />
      </label>
    </>
  );
}

function removeBreakpointOverride(element: SceneElement, breakpoint: Exclude<Breakpoint, 'desktop'>): SceneElement {
  if (breakpoint === 'tablet') {
    const { tablet: _removed, ...placement } = element.placement;
    return { ...element, placement };
  }
  const { mobile: _removed, ...placement } = element.placement;
  return { ...element, placement };
}

export function Inspector() {
  const { state, dispatch } = useEditor();
  const element = state.selectedId ? findElement(state.document, state.selectedId) : undefined;

  if (!element) {
    return (
      <aside className="rail rail--right" aria-label="Propriétés">
        <h2 className="rail-title">Propriétés</h2>
        <p className="inspector-empty">
          Sélectionne un texte, une image ou une peinture dans l’aperçu ou dans les calques.
        </p>
        <div className="inspector-group">
          <h3>Brouillon local</h3>
          <p className="inspector-help">
            Les changements sont réellement enregistrés dans ce navigateur. Ils ne sont pas encore envoyés à Supabase.
          </p>
          <button
            type="button"
            className="editor-button editor-button--danger editor-button--full"
            onClick={() => {
              if (window.confirm('Revenir au document de démonstration et effacer le brouillon local?')) {
                dispatch({ type: 'draft/reset' });
              }
            }}
          >
            Réinitialiser le brouillon
          </button>
        </div>
      </aside>
    );
  }

  const placement = resolvePlacement(element.placement, state.breakpoint);
  const overrideBreakpoint = state.breakpoint === 'desktop' ? null : state.breakpoint;
  const patch = (property: keyof typeof placement, value: number) =>
    dispatch({
      type: 'placement/patch',
      elementId: element.id,
      patch: { [property]: value },
      live: true,
    });

  return (
    <aside className="rail rail--right" aria-label="Propriétés">
      <h2 className="rail-title">{element.type} — {state.breakpoint}</h2>

      {(element.type === 'text' || element.type === 'button') && (
        <section className="inspector-group">
          <h3>Contenu</h3>
          {element.type === 'text' ? <PlainTextField element={element} /> : <ButtonFields element={element} />}
        </section>
      )}

      {element.type === 'paint' && (
        <section className="inspector-group">
          <h3>Couleur</h3>
          <div className="paint-swatches">
            {(Object.keys(PAINT_COLORS) as Array<keyof typeof PAINT_COLORS>).map((assetKey) => (
              <button
                type="button"
                className={element.assetKey === assetKey ? 'is-active' : ''}
                style={{ background: PAINT_COLORS[assetKey] }}
                aria-label={`Peinture ${assetKey}`}
                key={assetKey}
                onClick={() =>
                  dispatch({
                    type: 'element/update',
                    elementId: element.id,
                    updater: (current) =>
                      current.type === 'paint' ? { ...current, assetKey } : current,
                  })
                }
              />
            ))}
          </div>
        </section>
      )}

      <section className="inspector-group">
        <h3>Position et dimensions</h3>
        <RangeField label="Position X" value={placement.xPercent} min={0} max={100} step={0.1} suffix="%" onChange={(value) => patch('xPercent', value)} />
        <RangeField label="Position Y" value={placement.yPercent} min={0} max={100} step={0.1} suffix="%" onChange={(value) => patch('yPercent', value)} />
        <RangeField label="Largeur" value={placement.widthPercent} min={4} max={100} step={0.1} suffix="%" onChange={(value) => patch('widthPercent', value)} />
        <RangeField label="Rotation" value={placement.rotationDegrees} min={-180} max={180} suffix="°" onChange={(value) => patch('rotationDegrees', value)} />
        <RangeField label="Opacité" value={placement.opacity} min={0.05} max={1} step={0.01} onChange={(value) => patch('opacity', value)} />
        {element.type === 'text' && (
          <RangeField label="Taille du texte" value={placement.fontSize ?? 17} min={10} max={100} suffix="px" onChange={(value) => patch('fontSize', value)} />
        )}
        {element.type === 'image' && (
          <RangeField
            label="Coins arrondis"
            value={element.cornerRadius}
            min={0}
            max={120}
            suffix="px"
            onChange={(value) =>
              dispatch({
                type: 'element/update-live',
                elementId: element.id,
                updater: (current) => current.type === 'image' ? { ...current, cornerRadius: value } : current,
              })
            }
          />
        )}
      </section>

      {state.mode === 'advanced' && (
        <section className="inspector-group">
          <h3>Avancé</h3>
          <RangeField label="Ordre du calque" value={placement.zIndex} min={0} max={20} onChange={(value) => patch('zIndex', value)} />
          <RangeField label="Profondeur parallaxe" value={placement.parallaxDepth ?? 0} min={0} max={1} step={0.01} onChange={(value) => patch('parallaxDepth', value)} />
        </section>
      )}

      {overrideBreakpoint && (
        <section className="inspector-group">
          <h3>Héritage responsive</h3>
          <button
            type="button"
            className="editor-button editor-button--ghost editor-button--full"
            onClick={() =>
              dispatch({
                type: 'element/update',
                elementId: element.id,
                updater: (current) => removeBreakpointOverride(current, overrideBreakpoint),
              })
            }
          >
            Reprendre les valeurs Bureau
          </button>
        </section>
      )}

      <section className="inspector-group inspector-actions">
        <button
          type="button"
          className="editor-button editor-button--ghost"
          onClick={() =>
            dispatch({
              type: 'element/update',
              elementId: element.id,
              updater: (current) => ({ ...current, locked: !current.locked }),
            })
          }
        >
          {element.locked ? 'Déverrouiller' : 'Verrouiller'}
        </button>
        <button
          type="button"
          className="editor-button editor-button--danger"
          onClick={() => dispatch({ type: 'element/remove', elementId: element.id })}
        >
          Supprimer
        </button>
      </section>
    </aside>
  );
}
