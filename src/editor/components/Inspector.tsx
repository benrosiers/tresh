import {
  useEffect,
  useState,
} from 'react';
import {
  findElement,
  findSection,
  resolvePlacement,
} from '../model/documentOps';
import {
  getDefaultButtonStyle,
  getDefaultTextTypography,
  resolveButtonStyle,
  resolveTextTypography,
} from '../model/siteDocument';
import type {
  Breakpoint,
  ButtonStyle,
  ImageFit,
  ButtonVariant,
  ElementGlow,
  ElementShadow,
  Placement,
  SceneElement,
  ShapeKind,
  TextAlignment,
  TextFontFamily,
  TextFontWeight,
  TextTransform,
  TextTypography,
  TextVariant,
} from '../model/siteDocument';
import { uploadSiteMedia } from '../../media/siteMedia';
import {
  intrinsicImageFrameHeightPercent,
  resetImageFrameHeight,
  resolveImageCrop,
} from '../model/imageCrop';
import {
  getImageSourceDetails,
} from '../model/imageSourceDetails';
import { useEditor } from '../state/editorStore';
import {
  FRAME_WIDTH,
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
      updater: (current: SceneElement) =>
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


const FONT_FAMILY_OPTIONS: Array<{
  value: TextFontFamily;
  label: string;
}> = [
  { value: 'serif', label: 'Fraunces — sérif' },
  { value: 'sans', label: 'Inter — sans sérif' },
  { value: 'mono', label: 'IBM Plex Mono — mono' },
  { value: 'system', label: 'Système' },
];

const FONT_WEIGHT_OPTIONS: TextFontWeight[] = [
  300,
  400,
  500,
  600,
  700,
  800,
  900,
];

const TEXT_ALIGNMENT_OPTIONS: Array<{
  value: TextAlignment;
  label: string;
  glyph: string;
}> = [
  { value: 'left', label: 'Aligner à gauche', glyph: '≡' },
  { value: 'center', label: 'Centrer', glyph: '≣' },
  { value: 'right', label: 'Aligner à droite', glyph: '≡' },
];

function TextTypographyFields({
  element,
}: {
  element: Extract<SceneElement, { type: 'text' }>;
}) {
  const { dispatch } = useEditor();
  const typography = resolveTextTypography(element);

  const update = (
    values: Partial<TextTypography>,
    live = false,
  ) => {
    dispatch({
      type: live ? 'element/update-live' : 'element/update',
      elementId: element.id,
      updater: (current: SceneElement) =>
        current.type === 'text'
          ? {
              ...current,
              typography: {
                ...resolveTextTypography(current),
                ...values,
              },
            }
          : current,
    });
  };

  const changeVariant = (variant: TextVariant) => {
    dispatch({
      type: 'element/update',
      elementId: element.id,
      updater: (current) =>
        current.type === 'text'
          ? {
              ...current,
              variant,
              typography: getDefaultTextTypography(variant),
            }
          : current,
    });
  };

  const reset = () => {
    dispatch({
      type: 'element/update',
      elementId: element.id,
      updater: (current) => {
        if (current.type !== 'text') return current;

        const {
          typography: _typography,
          ...withoutTypography
        } = current;

        return withoutTypography;
      },
    });
  };

  return (
    <>
      <label className="inspector-field">
        <span>Style de base</span>
        <select
          value={element.variant}
          onChange={(event) =>
            changeVariant(event.currentTarget.value as TextVariant)
          }
        >
          <option value="eyebrow">Surtitre</option>
          <option value="heading">Titre</option>
          <option value="body">Texte courant</option>
        </select>
      </label>

      <ColorField
        label="Couleur du texte"
        value={typography.color}
        onChange={(color) => update({ color })}
      />

      <label className="inspector-field">
        <span>Police</span>
        <select
          value={typography.fontFamily}
          onChange={(event) =>
            update({
              fontFamily:
                event.currentTarget.value as TextFontFamily,
            })
          }
        >
          {FONT_FAMILY_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="inspector-field">
        <span>Graisse</span>
        <select
          value={typography.fontWeight}
          onChange={(event) =>
            update({
              fontWeight: Number(
                event.currentTarget.value,
              ) as TextFontWeight,
            })
          }
        >
          {FONT_WEIGHT_OPTIONS.map((weight) => (
            <option value={weight} key={weight}>
              {weight}
            </option>
          ))}
        </select>
      </label>

      <label className="effect-toggle">
        <input
          type="checkbox"
          checked={typography.fontStyle === 'italic'}
          onChange={(event) =>
            update({
              fontStyle: event.currentTarget.checked
                ? 'italic'
                : 'normal',
            })
          }
        />
        <span>Italique</span>
      </label>

      <div
        className="typography-alignment"
        role="group"
        aria-label="Alignement du texte"
      >
        {TEXT_ALIGNMENT_OPTIONS.map((option) => (
          <button
            type="button"
            className={
              typography.textAlign === option.value
                ? 'is-active'
                : ''
            }
            aria-label={option.label}
            aria-pressed={typography.textAlign === option.value}
            title={option.label}
            onClick={() => update({ textAlign: option.value })}
            key={option.value}
          >
            <span
              className={`typography-alignment__glyph typography-alignment__glyph--${option.value}`}
              aria-hidden="true"
            >
              {option.glyph}
            </span>
          </button>
        ))}
      </div>

      <RangeField
        label="Hauteur de ligne"
        value={typography.lineHeight}
        min={0.6}
        max={3}
        step={0.05}
        onChange={(lineHeight) =>
          update({ lineHeight }, true)
        }
      />

      <RangeField
        label="Espacement des lettres"
        value={typography.letterSpacing}
        min={-0.2}
        max={1}
        step={0.005}
        suffix="em"
        onChange={(letterSpacing) =>
          update({ letterSpacing }, true)
        }
      />

      <label className="inspector-field">
        <span>Casse</span>
        <select
          value={typography.textTransform}
          onChange={(event) =>
            update({
              textTransform:
                event.currentTarget.value as TextTransform,
            })
          }
        >
          <option value="none">Originale</option>
          <option value="uppercase">MAJUSCULES</option>
          <option value="lowercase">minuscules</option>
          <option value="capitalize">Première Lettre</option>
        </select>
      </label>

      <button
        type="button"
        className="editor-button editor-button--ghost editor-button--full"
        onClick={reset}
      >
        Réinitialiser la typographie
      </button>
    </>
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
  const style = resolveButtonStyle(element);

  useEffect(() => {
    setLabel(element.label['fr-CA'] ?? '');
    setHref(element.href);
  }, [element]);

  const commit = () => {
    dispatch({
      type: 'element/update',
      elementId: element.id,
      updater: (current: SceneElement) =>
        current.type === 'button'
          ? { ...current, label: { ...current.label, 'fr-CA': label }, href }
          : current,
    });
  };

  const updateStyle = (
    values: Partial<ButtonStyle>,
    live = false,
  ) => {
    dispatch({
      type: live ? 'element/update-live' : 'element/update',
      elementId: element.id,
      updater: (current: SceneElement) =>
        current.type === 'button'
          ? {
              ...current,
              style: {
                ...resolveButtonStyle(current),
                ...values,
              },
            }
          : current,
    });
  };

  const changeVariant = (variant: ButtonVariant) => {
    dispatch({
      type: 'element/update',
      elementId: element.id,
      updater: (current: SceneElement) =>
        current.type === 'button'
          ? {
              ...current,
              variant,
              style: getDefaultButtonStyle(variant),
            }
          : current,
    });
  };

  const setOpenInNewTab = (openInNewTab: boolean) => {
    dispatch({
      type: 'element/update',
      elementId: element.id,
      updater: (current: SceneElement) =>
        current.type === 'button'
          ? { ...current, openInNewTab }
          : current,
    });
  };

  const resetStyle = () => {
    dispatch({
      type: 'element/update',
      elementId: element.id,
      updater: (current: SceneElement) => {
        if (current.type !== 'button') return current;

        const {
          style: _style,
          ...withoutStyle
        } = current;

        return withoutStyle;
      },
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

      <label className="effect-toggle">
        <input
          type="checkbox"
          checked={element.openInNewTab ?? false}
          onChange={(event) =>
            setOpenInNewTab(event.currentTarget.checked)
          }
        />
        <span>Ouvrir dans un nouvel onglet</span>
      </label>

      <label className="inspector-field">
        <span>Style visuel</span>
        <select
          value={element.variant}
          onChange={(event) =>
            changeVariant(event.currentTarget.value as ButtonVariant)
          }
        >
          <option value="primary">Plein</option>
          <option value="secondary">Contour</option>
          <option value="text">Transparent</option>
        </select>
      </label>

      <ColorField
        label="Couleur de fond"
        value={style.backgroundColor}
        onChange={(backgroundColor) => updateStyle({ backgroundColor })}
      />

      <ColorField
        label="Couleur du texte"
        value={style.textColor}
        onChange={(textColor) => updateStyle({ textColor })}
      />

      <ColorField
        label="Couleur du contour"
        value={style.borderColor}
        onChange={(borderColor) => updateStyle({ borderColor })}
      />

      <RangeField
        label="Épaisseur du contour"
        value={style.borderWidth}
        min={0}
        max={12}
        suffix="px"
        onChange={(borderWidth) =>
          updateStyle({ borderWidth }, true)
        }
      />

      <RangeField
        label="Coins arrondis"
        value={style.borderRadius}
        min={0}
        max={999}
        suffix="px"
        onChange={(borderRadius) =>
          updateStyle({ borderRadius }, true)
        }
      />

      <label className="inspector-field">
        <span>Police</span>
        <select
          value={style.fontFamily}
          onChange={(event) =>
            updateStyle({
              fontFamily:
                event.currentTarget.value as TextFontFamily,
            })
          }
        >
          {FONT_FAMILY_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="inspector-field">
        <span>Graisse</span>
        <select
          value={style.fontWeight}
          onChange={(event) =>
            updateStyle({
              fontWeight: Number(
                event.currentTarget.value,
              ) as TextFontWeight,
            })
          }
        >
          {FONT_WEIGHT_OPTIONS.map((weight) => (
            <option value={weight} key={weight}>
              {weight}
            </option>
          ))}
        </select>
      </label>

      <RangeField
        label="Taille du texte"
        value={style.fontSize}
        min={8}
        max={96}
        suffix="px"
        onChange={(fontSize) =>
          updateStyle({ fontSize }, true)
        }
      />

      <div className="button-hover-fields">
        <strong>Survol</strong>

        <ColorField
          label="Fond au survol"
          value={style.hoverBackgroundColor}
          onChange={(hoverBackgroundColor) =>
            updateStyle({ hoverBackgroundColor })
          }
        />

        <ColorField
          label="Texte au survol"
          value={style.hoverTextColor}
          onChange={(hoverTextColor) =>
            updateStyle({ hoverTextColor })
          }
        />

        <ColorField
          label="Contour au survol"
          value={style.hoverBorderColor}
          onChange={(hoverBorderColor) =>
            updateStyle({ hoverBorderColor })
          }
        />
      </div>

      <button
        type="button"
        className="editor-button editor-button--ghost editor-button--full"
        onClick={resetStyle}
      >
        Réinitialiser le style du bouton
      </button>
    </>
  );
}

function ImageFields({
  element,
}: {
  element: Extract<SceneElement, { type: 'image' }>;
}) {
  const { state, dispatch, saveNow } = useEditor();
  const [altText, setAltText] = useState(
    element.altText['fr-CA'] ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setAltText(element.altText['fr-CA'] ?? '');
  }, [element.id, element.altText]);

  useEffect(() => {
    setMessage(null);
  }, [element.id]);

  const placement = resolvePlacement(
    element.placement,
    state.breakpoint,
  );
  const crop = resolveImageCrop(
    element,
    state.breakpoint,
  );
  const sourceDetails = getImageSourceDetails(element);
  const section = findSection(
    state.document,
    element.sectionId,
  );
  const frameHeightPercent =
    crop.frameHeightPercent ??
    intrinsicImageFrameHeightPercent(
      placement,
      element.aspectRatio,
      FRAME_WIDTH[state.breakpoint],
      section?.height[state.breakpoint] ?? 1,
    );

  const patchImagePlacement = (
    patch: Partial<Placement>,
    live = false,
  ) => {
    dispatch({
      type: 'placement/patch',
      elementId: element.id,
      patch,
      live,
    });
  };

  const commitAltText = () => {
    dispatch({
      type: 'element/update',
      elementId: element.id,
      updater: (current) =>
        current.type === 'image'
          ? {
              ...current,
              altText: {
                ...current.altText,
                'fr-CA': altText,
              },
            }
          : current,
    });
  };

  const replaceImage = async (file: File) => {
    setBusy(true);
    setMessage(null);

    try {
      const uploaded = await uploadSiteMedia(file);

      dispatch({
        type: 'element/update',
        elementId: element.id,
        updater: (current) =>
          current.type === 'image'
            ? {
                ...current,
                source: {
                  kind: 'url',
                  url: uploaded.publicUrl,
                  fileName: uploaded.fileName,
                  storagePath: uploaded.storagePath,
                  mimeType: uploaded.mimeType as
                    | 'image/png'
                    | 'image/jpeg'
                    | 'image/webp',
                },
                aspectRatio: uploaded.aspectRatio,
                fit: 'contain',
                cornerRadius: 0,
                altText: {
                  ...current.altText,
                  'fr-CA':
                    current.altText['fr-CA'] ||
                    uploaded.fileName,
                },
              }
            : current,
      });

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });
      await saveNow();

      setMessage(
        `${uploaded.fileName} importé et sauvegardé — transparence conservée.`,
      );
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Impossible d’importer ou de sauvegarder cette image.',
      );
    } finally {
      setBusy(false);
    }
  };

  const copySource = async () => {
    if (!sourceDetails.copyValue) return;

    try {
      await navigator.clipboard.writeText(
        sourceDetails.copyValue,
      );
      setMessage('Chemin de l’image copié.');
    } catch {
      setMessage(
        'Impossible de copier automatiquement le chemin.',
      );
    }
  };

  return (
    <div className="image-upload-panel">
      <div className="image-source-card">
        <div className="image-source-card__preview">
          {sourceDetails.previewUrl ? (
            <img
              src={sourceDetails.previewUrl}
              alt=""
            />
          ) : (
            <span aria-hidden="true">▨</span>
          )}
        </div>

        <div className="image-source-card__details">
          <strong>{sourceDetails.fileName}</strong>
          <span>{sourceDetails.sourceLabel}</span>
          <code
            title={
              sourceDetails.storagePath ??
              sourceDetails.publicUrl ??
              'Aucune source persistée'
            }
          >
            {sourceDetails.storagePath ??
              sourceDetails.publicUrl ??
              'Aucune source persistée'}
          </code>
          <button
            type="button"
            className="editor-button editor-button--ghost"
            disabled={!sourceDetails.copyValue}
            onClick={() => void copySource()}
          >
            Copier le chemin
          </button>
        </div>
      </div>

      <label className="inspector-field">
        <span>Texte alternatif</span>
        <input
          value={altText}
          onChange={(event) =>
            setAltText(event.currentTarget.value)
          }
          onBlur={commitAltText}
        />
      </label>

      <label className="inspector-field">
        <span>Fichier PNG, JPEG ou WebP</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';

            if (file) {
              void replaceImage(file);
            }
          }}
        />
      </label>

      <label className="inspector-field">
        <span>Ajustement — {state.breakpoint}</span>
        <select
          value={crop.fit}
          onChange={(event) => {
            patchImagePlacement({
              imageFit: event.currentTarget.value as ImageFit,
            });
          }}
        >
          <option value="contain">Image complète</option>
          <option value="cover">Remplir le cadre</option>
          <option value="fill">Étirer dans le cadre</option>
        </select>
      </label>

      <RangeField
        label={`Hauteur du cadre — ${state.breakpoint}`}
        value={frameHeightPercent}
        min={2}
        max={100}
        step={0.1}
        suffix="%"
        onChange={(heightPercent) =>
          patchImagePlacement(
            { heightPercent },
            true,
          )
        }
      />

      {crop.fit !== 'fill' && (
        <>
          <RangeField
            label={`Point focal X — ${state.breakpoint}`}
            value={crop.focalX}
            min={0}
            max={100}
            step={0.1}
            suffix="%"
            onChange={(imageFocalX) =>
              patchImagePlacement(
                { imageFocalX },
                true,
              )
            }
          />

          <RangeField
            label={`Point focal Y — ${state.breakpoint}`}
            value={crop.focalY}
            min={0}
            max={100}
            step={0.1}
            suffix="%"
            onChange={(imageFocalY) =>
              patchImagePlacement(
                { imageFocalY },
                true,
              )
            }
          />
        </>
      )}

      <div className="image-crop-actions">
        <button
          type="button"
          className="editor-button editor-button--ghost"
          disabled={crop.fit === 'fill'}
          onClick={() =>
            patchImagePlacement({
              imageFocalX: 50,
              imageFocalY: 50,
            })
          }
        >
          Recentrer
        </button>

        <button
          type="button"
          className="editor-button editor-button--ghost"
          onClick={() =>
            dispatch({
              type: 'element/update',
              elementId: element.id,
              updater: (current) =>
                current.type === 'image'
                  ? resetImageFrameHeight(
                      current,
                      state.breakpoint,
                    )
                  : current,
            })
          }
        >
          Cadre selon l’image
        </button>
      </div>

      <p className="inspector-help">
        Glisse la cible directement sur l’image sélectionnée. Les réglages
        s’appliquent seulement au format {state.breakpoint}.
      </p>

      <p
        className={`image-upload-status ${
          message?.startsWith('Impossible') ||
          message?.startsWith('Utilise') ||
          message?.startsWith('L’image') ||
          message?.startsWith('Le fichier') ||
          message?.startsWith('Connecte')
            ? 'is-error'
            : ''
        }`}
        role="status"
      >
        {busy
          ? 'Téléversement vers Tresh…'
          : message ??
            'Les PNG transparents restent transparents. Limite : 15 Mo.'}
      </p>
    </div>
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

      {element.type === 'text' && (
        <section className="inspector-group">
          <h3>Typographie</h3>
          <TextTypographyFields element={element} />
        </section>
      )}

      {element.type === 'image' && (
        <section className="inspector-group">
          <h3>Image</h3>
          <ImageFields element={element} />
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
          className="editor-button editor-button--ghost"
          title="Dupliquer l’élément sélectionné (Ctrl+D)"
          onClick={() =>
            dispatch({
              type: 'element/duplicate',
              elementId: element.id,
            })
          }
        >
          Dupliquer
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
