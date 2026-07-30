import {
  useEffect,
  useState,
} from 'react';
import {
  findElement,
  resolvePlacement,
} from '../model/documentOps';
import type {
  Breakpoint,
  ElementGlow,
  ElementShadow,
  Placement,
  SceneElement,
  ShapeKind,
} from '../model/siteDocument';
import { useEditor } from '../state/editorStore';
import {
  PAINT_COLORS,
  SHAPE_LABELS,
} from './editorConstants';

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperInstance {
  open: () => Promise<EyeDropperResult>;
}

type EyeDropperConstructor = new () => EyeDropperInstance;

type WindowWithEyeDropper = Window & {
  EyeDropper?: EyeDropperConstructor;
};

const DEFAULT_SHADOW: ElementShadow = {
  enabled: false,
  color: '#000000',
  offsetX: 0,
  offsetY: 12,
  blur: 28,
  opacity: 0.35,
};

const DEFAULT_GLOW: ElementGlow = {
  enabled: false,
  color: '#57D9C4',
  blur: 28,
  intensity: 0.65,
};

const FIXED_RATIO_SHAPES: ShapeKind[] = [
  'square',
  'circle',
  'triangle',
  'diamond',
  'star',
];

function normalizeColor(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : null;
}

function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: RangeFieldProps) {
  const { dispatch } = useEditor();

  return (
    <label className="inspector-field">
      <span>
        {label}
        <output>
          {Number.isInteger(value) ? value : value.toFixed(2)}
          {suffix}
        </output>
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

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const EyeDropper =
    typeof window === 'undefined'
      ? undefined
      : (window as WindowWithEyeDropper).EyeDropper;

  const commit = () => {
    const color = normalizeColor(draft);
    if (!color) {
      setDraft(value);
      return;
    }

    setDraft(color);
    onChange(color);
  };

  const pickColor = async () => {
    if (!EyeDropper) return;

    try {
      const result = await new EyeDropper().open();
      const color = normalizeColor(result.sRGBHex);
      if (!color) return;

      setDraft(color);
      onChange(color);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('La pipette n’a pas pu lire la couleur.', error);
    }
  };

  return (
    <label className="inspector-field">
      <span>{label}</span>
      <span className="color-field">
        <input
          className="color-field__native"
          type="color"
          value={normalizeColor(value) ?? '#000000'}
          aria-label={`${label} — sélecteur`}
          onChange={(event) => {
            const color = event.currentTarget.value.toUpperCase();
            setDraft(color);
            onChange(color);
          }}
        />
        <input
          className="color-field__text"
          value={draft}
          maxLength={7}
          spellCheck={false}
          aria-label={`${label} — valeur hexadécimale`}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          onBlur={commit}
        />
        <button
          type="button"
          className="color-field__pipette"
          disabled={!EyeDropper}
          title={
            EyeDropper
              ? 'Prélever une couleur à l’écran'
              : 'Pipette non disponible dans ce navigateur'
          }
          aria-label="Prélever une couleur à l’écran"
          onClick={() => void pickColor()}
        >
          ⌾
        </button>
      </span>
    </label>
  );
}

function PlainTextField({
  element,
}: {
  element: Extract<SceneElement, { type: 'text' }>;
}) {
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

function ButtonFields({
  element,
}: {
  element: Extract<SceneElement, { type: 'button' }>;
}) {
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
        <input
          value={label}
          onChange={(event) => setLabel(event.currentTarget.value)}
          onBlur={commit}
        />
      </label>
      <label className="inspector-field">
        <span>Lien</span>
        <input
          value={href}
          onChange={(event) => setHref(event.currentTarget.value)}
          onBlur={commit}
        />
      </label>
    </>
  );
}

function removeBreakpointOverride(
  element: SceneElement,
  breakpoint: Exclude<Breakpoint, 'desktop'>,
): SceneElement {
  if (breakpoint === 'tablet') {
    const { tablet: _removed, ...placement } = element.placement;
    return { ...element, placement };
  }

  const { mobile: _removed, ...placement } = element.placement;
  return { ...element, placement };
}

export function Inspector() {
  const { state, dispatch } = useEditor();
  const element = state.selectedId
    ? findElement(state.document, state.selectedId)
    : undefined;

  if (!element) {
    return (
      <aside className="rail rail--right" aria-label="Propriétés">
        <h2 className="rail-title">Propriétés</h2>
        <p className="inspector-empty">
          Sélectionne un élément dans l’aperçu ou dans les calques.
        </p>
        <div className="inspector-group">
          <h3>{state.cloud.pageId ? 'Brouillon Tresh' : 'Brouillon local'}</h3>
          <p className="inspector-help">
            {state.cloud.pageId
              ? 'Les changements sont enregistrés dans Tresh et gardés localement comme copie de secours.'
              : 'Les changements sont enregistrés dans ce navigateur.'}
          </p>
          {state.cloud.message && (
            <p className="inspector-help" role="alert">
              {state.cloud.message}
            </p>
          )}
          <button
            type="button"
            className="editor-button editor-button--danger editor-button--full"
            onClick={() => {
              if (
                window.confirm(
                  'Revenir au document de démonstration et effacer le brouillon local?',
                )
              ) {
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
  const overrideBreakpoint =
    state.breakpoint === 'desktop' ? null : state.breakpoint;

  const dispatchElementUpdate = (
    updater: (current: SceneElement) => SceneElement,
    live = false,
  ) => {
    if (live) {
      dispatch({
        type: 'element/update-live',
        elementId: element.id,
        updater,
      });
      return;
    }

    dispatch({
      type: 'element/update',
      elementId: element.id,
      updater,
    });
  };

  const patch = (property: keyof Placement, value: number) => {
    dispatch({
      type: 'placement/patch',
      elementId: element.id,
      patch: { [property]: value },
      live: true,
    });
  };

  const shadow = element.effects?.shadow ?? DEFAULT_SHADOW;
  const glow = element.effects?.glow ?? DEFAULT_GLOW;

  const patchShadow = (values: Partial<ElementShadow>, live = false) => {
    dispatchElementUpdate(
      (current) => ({
        ...current,
        effects: {
          ...current.effects,
          shadow: {
            ...DEFAULT_SHADOW,
            ...current.effects?.shadow,
            ...values,
          },
        },
      }),
      live,
    );
  };

  const patchGlow = (values: Partial<ElementGlow>, live = false) => {
    dispatchElementUpdate(
      (current) => ({
        ...current,
        effects: {
          ...current.effects,
          glow: {
            ...DEFAULT_GLOW,
            ...current.effects?.glow,
            ...values,
          },
        },
      }),
      live,
    );
  };

  const fixedRatioShape =
    element.type === 'shape' && FIXED_RATIO_SHAPES.includes(element.shapeKind);

  return (
    <aside className="rail rail--right" aria-label="Propriétés">
      <h2 className="rail-title">
        {element.type} — {state.breakpoint}
      </h2>

      {(element.type === 'text' || element.type === 'button') && (
        <section className="inspector-group">
          <h3>Contenu</h3>
          {element.type === 'text' ? (
            <PlainTextField element={element} />
          ) : (
            <ButtonFields element={element} />
          )}
        </section>
      )}

      {element.type === 'paint' && (
        <section className="inspector-group">
          <h3>Couleur</h3>
          <div className="paint-swatches">
            {(Object.keys(PAINT_COLORS) as Array<keyof typeof PAINT_COLORS>).map(
              (assetKey) => (
                <button
                  type="button"
                  className={
                    !element.customColor && element.assetKey === assetKey
                      ? 'is-active'
                      : ''
                  }
                  style={{ background: PAINT_COLORS[assetKey] }}
                  aria-label={`Peinture ${assetKey}`}
                  key={assetKey}
                  onClick={() =>
                    dispatchElementUpdate((current) => {
                      if (current.type !== 'paint') return current;
                      const { customColor: _customColor, ...paint } = current;
                      return { ...paint, assetKey };
                    })
                  }
                />
              ),
            )}
          </div>
          <ColorField
            label="Couleur personnalisée"
            value={element.customColor ?? PAINT_COLORS[element.assetKey]}
            onChange={(customColor) =>
              dispatchElementUpdate((current) =>
                current.type === 'paint'
                  ? { ...current, customColor }
                  : current,
              )
            }
          />
        </section>
      )}

      {element.type === 'shape' && (
        <section className="inspector-group">
          <h3>Forme</h3>
          <label className="inspector-field">
            <span>Type</span>
            <select
              value={element.shapeKind}
              onChange={(event) => {
                const shapeKind = event.currentTarget.value as ShapeKind;
                dispatchElementUpdate((current) => {
                  if (current.type !== 'shape') return current;

                  const nextPlacement = {
                    ...current.placement,
                    desktop: {
                      ...current.placement.desktop,
                      ...(shapeKind === 'line'
                        ? { heightPercent: 4 }
                        : {}),
                    },
                  };

                  return {
                    ...current,
                    shapeKind,
                    strokeWidth:
                      shapeKind === 'line' && current.strokeWidth === 0
                        ? 4
                        : current.strokeWidth,
                    placement: nextPlacement,
                  };
                });
              }}
            >
              {(Object.entries(SHAPE_LABELS) as Array<[ShapeKind, string]>).map(
                ([shapeKind, label]) => (
                  <option value={shapeKind} key={shapeKind}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          {element.shapeKind === 'line' ? (
            <>
              <ColorField
                label="Couleur de la ligne"
                value={element.strokeColor}
                onChange={(strokeColor) =>
                  dispatchElementUpdate((current) =>
                    current.type === 'shape'
                      ? { ...current, strokeColor }
                      : current,
                  )
                }
              />
              <RangeField
                label="Épaisseur"
                value={Math.max(1, element.strokeWidth || 4)}
                min={1}
                max={40}
                suffix="px"
                onChange={(strokeWidth) =>
                  dispatchElementUpdate(
                    (current) =>
                      current.type === 'shape'
                        ? { ...current, strokeWidth }
                        : current,
                    true,
                  )
                }
              />
            </>
          ) : (
            <>
              <ColorField
                label="Remplissage"
                value={element.fillColor}
                onChange={(fillColor) =>
                  dispatchElementUpdate((current) =>
                    current.type === 'shape'
                      ? { ...current, fillColor }
                      : current,
                  )
                }
              />
              <ColorField
                label="Contour"
                value={element.strokeColor}
                onChange={(strokeColor) =>
                  dispatchElementUpdate((current) =>
                    current.type === 'shape'
                      ? { ...current, strokeColor }
                      : current,
                  )
                }
              />
              <RangeField
                label="Épaisseur du contour"
                value={element.strokeWidth}
                min={0}
                max={40}
                suffix="px"
                onChange={(strokeWidth) =>
                  dispatchElementUpdate(
                    (current) =>
                      current.type === 'shape'
                        ? { ...current, strokeWidth }
                        : current,
                    true,
                  )
                }
              />
              {(element.shapeKind === 'rectangle' ||
                element.shapeKind === 'square') && (
                <RangeField
                  label="Coins arrondis"
                  value={element.cornerRadius}
                  min={0}
                  max={50}
                  suffix="%"
                  onChange={(cornerRadius) =>
                    dispatchElementUpdate(
                      (current) =>
                        current.type === 'shape'
                          ? { ...current, cornerRadius }
                          : current,
                      true,
                    )
                  }
                />
              )}
            </>
          )}
        </section>
      )}

      <section className="inspector-group">
        <h3>Position et dimensions</h3>
        <RangeField
          label="Position X"
          value={placement.xPercent}
          min={0}
          max={100}
          step={0.1}
          suffix="%"
          onChange={(value) => patch('xPercent', value)}
        />
        <RangeField
          label="Position Y"
          value={placement.yPercent}
          min={0}
          max={100}
          step={0.1}
          suffix="%"
          onChange={(value) => patch('yPercent', value)}
        />
        <RangeField
          label="Largeur"
          value={placement.widthPercent}
          min={4}
          max={100}
          step={0.1}
          suffix="%"
          onChange={(value) => patch('widthPercent', value)}
        />
        {element.type === 'shape' && !fixedRatioShape && (
          <RangeField
            label="Hauteur"
            value={placement.heightPercent ?? 18}
            min={1}
            max={100}
            step={0.1}
            suffix="%"
            onChange={(value) => patch('heightPercent', value)}
          />
        )}
        <RangeField
          label="Rotation"
          value={placement.rotationDegrees}
          min={-180}
          max={180}
          suffix="°"
          onChange={(value) => patch('rotationDegrees', value)}
        />
        <RangeField
          label="Opacité"
          value={placement.opacity}
          min={0.05}
          max={1}
          step={0.01}
          onChange={(value) => patch('opacity', value)}
        />
        {element.type === 'text' && (
          <RangeField
            label="Taille du texte"
            value={placement.fontSize ?? 17}
            min={10}
            max={100}
            suffix="px"
            onChange={(value) => patch('fontSize', value)}
          />
        )}
        {element.type === 'image' && (
          <RangeField
            label="Coins arrondis"
            value={element.cornerRadius}
            min={0}
            max={120}
            suffix="px"
            onChange={(cornerRadius) =>
              dispatchElementUpdate(
                (current) =>
                  current.type === 'image'
                    ? { ...current, cornerRadius }
                    : current,
                true,
              )
            }
          />
        )}
      </section>

      <section className="inspector-group">
        <h3>Effets</h3>
        <label className="effect-toggle">
          <input
            type="checkbox"
            checked={shadow.enabled}
            onChange={(event) =>
              patchShadow({ enabled: event.currentTarget.checked })
            }
          />
          <span>Ombre</span>
        </label>

        {shadow.enabled && (
          <div className="effect-controls">
            <ColorField
              label="Couleur de l’ombre"
              value={shadow.color}
              onChange={(color) => patchShadow({ color })}
            />
            <RangeField
              label="Décalage X"
              value={shadow.offsetX}
              min={-50}
              max={50}
              suffix="px"
              onChange={(offsetX) => patchShadow({ offsetX }, true)}
            />
            <RangeField
              label="Décalage Y"
              value={shadow.offsetY}
              min={-50}
              max={50}
              suffix="px"
              onChange={(offsetY) => patchShadow({ offsetY }, true)}
            />
            <RangeField
              label="Flou"
              value={shadow.blur}
              min={0}
              max={100}
              suffix="px"
              onChange={(blur) => patchShadow({ blur }, true)}
            />
            <RangeField
              label="Intensité"
              value={shadow.opacity}
              min={0}
              max={1}
              step={0.01}
              onChange={(opacity) => patchShadow({ opacity }, true)}
            />
          </div>
        )}

        <label className="effect-toggle">
          <input
            type="checkbox"
            checked={glow.enabled}
            onChange={(event) =>
              patchGlow({ enabled: event.currentTarget.checked })
            }
          />
          <span>Lueur</span>
        </label>

        {glow.enabled && (
          <div className="effect-controls">
            <ColorField
              label="Couleur de la lueur"
              value={glow.color}
              onChange={(color) => patchGlow({ color })}
            />
            <RangeField
              label="Rayon"
              value={glow.blur}
              min={0}
              max={100}
              suffix="px"
              onChange={(blur) => patchGlow({ blur }, true)}
            />
            <RangeField
              label="Intensité"
              value={glow.intensity}
              min={0}
              max={1}
              step={0.01}
              onChange={(intensity) => patchGlow({ intensity }, true)}
            />
          </div>
        )}
      </section>

      {state.mode === 'advanced' && (
        <section className="inspector-group">
          <h3>Avancé</h3>
          <RangeField
            label="Ordre du calque"
            value={placement.zIndex}
            min={0}
            max={20}
            onChange={(value) => patch('zIndex', value)}
          />
          <RangeField
            label="Profondeur parallaxe"
            value={placement.parallaxDepth ?? 0}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => patch('parallaxDepth', value)}
          />
        </section>
      )}

      {overrideBreakpoint && (
        <section className="inspector-group">
          <h3>Héritage responsive</h3>
          <button
            type="button"
            className="editor-button editor-button--ghost editor-button--full"
            onClick={() =>
              dispatchElementUpdate((current) =>
                removeBreakpointOverride(current, overrideBreakpoint),
              )
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
            dispatchElementUpdate((current) => ({
              ...current,
              locked: !current.locked,
            }))
          }
        >
          {element.locked ? 'Déverrouiller' : 'Verrouiller'}
        </button>
        <button
          type="button"
          className="editor-button editor-button--danger"
          onClick={() =>
            dispatch({ type: 'element/remove', elementId: element.id })
          }
        >
          Supprimer
        </button>
      </section>
    </aside>
  );
}
