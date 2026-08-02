import { useState } from 'react';
import { uploadSiteMedia } from '../../media/siteMedia';
import type {
  SiteBranding,
  SiteFooter,
  SiteLink,
  SiteNavigation,
} from '../model/siteDocument';
import { useEditor } from '../state/editorStore';

function createLink(prefix: string, label: string): SiteLink {
  return {
    id: `${prefix}-${crypto.randomUUID().slice(0, 8)}`,
    label,
    href: '#',
  };
}

function LinkListEditor({
  title,
  links,
  onChange,
}: {
  title: string;
  links: SiteLink[];
  onChange: (links: SiteLink[]) => void;
}) {
  const update = (
    index: number,
    patch: Partial<Pick<SiteLink, 'label' | 'href'>>,
  ) => {
    onChange(
      links.map((link, candidateIndex) =>
        candidateIndex === index
          ? { ...link, ...patch }
          : link,
      ),
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= links.length) return;

    const next = [...links];
    const current = next[index];
    const destination = next[nextIndex];

    if (!current || !destination) return;

    next[index] = destination;
    next[nextIndex] = current;
    onChange(next);
  };

  return (
    <div className="chrome-link-editor">
      <div className="chrome-link-editor__heading">
        <strong>{title}</strong>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...links,
              createLink('link', 'Nouveau lien'),
            ])
          }
        >
          + Ajouter
        </button>
      </div>

      {links.length === 0 ? (
        <p className="chrome-link-editor__empty">Aucun lien.</p>
      ) : (
        links.map((link, index) => (
          <div className="chrome-link-row" key={link.id}>
            <input
              aria-label={`${title} — libellé ${index + 1}`}
              value={link.label}
              placeholder="Libellé"
              onChange={(event) =>
                update(index, {
                  label: event.currentTarget.value,
                })
              }
            />
            <input
              aria-label={`${title} — adresse ${index + 1}`}
              value={link.href}
              placeholder="#section ou https://"
              onChange={(event) =>
                update(index, {
                  href: event.currentTarget.value,
                })
              }
            />
            <div className="chrome-link-row__actions">
              <button
                type="button"
                disabled={index === 0}
                aria-label="Monter le lien"
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === links.length - 1}
                aria-label="Descendre le lien"
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label="Supprimer le lien"
                onClick={() =>
                  onChange(
                    links.filter(
                      (candidate) => candidate.id !== link.id,
                    ),
                  )
                }
              >
                ×
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="chrome-inline-field">
      <span>{label}</span>
      <span className="chrome-color-input">
        <input
          type="color"
          value={value}
          aria-label={label}
          onChange={(event) =>
            onChange(event.currentTarget.value.toUpperCase())
          }
        />
        <code>{value}</code>
      </span>
    </label>
  );
}

export function GlobalChromePanel() {
  const { state, dispatch } = useEditor();
  const [uploading, setUploading] = useState<
    'favicon' | 'logo' | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);

  const patchBranding = (patch: Partial<SiteBranding>) => {
    dispatch({
      type: 'site/update',
      updater: (document) => ({
        ...document,
        branding: {
          ...document.branding,
          ...patch,
        },
      }),
    });
  };

  const patchNavigation = (
    patch: Partial<SiteNavigation>,
  ) => {
    dispatch({
      type: 'site/update',
      updater: (document) => ({
        ...document,
        navigation: {
          ...document.navigation,
          ...patch,
        },
      }),
    });
  };

  const patchFooter = (patch: Partial<SiteFooter>) => {
    dispatch({
      type: 'site/update',
      updater: (document) => ({
        ...document,
        footer: {
          ...document.footer,
          ...patch,
        },
      }),
    });
  };

  const upload = async (
    kind: 'favicon' | 'logo',
    file: File,
  ) => {
    setUploading(kind);
    setMessage(null);

    try {
      const media = await uploadSiteMedia(file);

      if (kind === 'favicon') {
        patchBranding({
          faviconUrl: media.publicUrl,
        });
      } else {
        patchNavigation({
          logoUrl: media.publicUrl,
        });
      }

      setMessage(`${media.fileName} importé.`);
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'importer cette image.",
      );
    } finally {
      setUploading(null);
    }
  };

  const breakpoint = state.breakpoint;
  const navigation = state.document.navigation;
  const footer = state.document.footer;
  const branding = state.document.branding;

  return (
    <section className="global-chrome-panel">
      <h2 className="rail-title">Site global</h2>

      <details open>
        <summary>Identité et favicon</summary>
        <div className="global-chrome-panel__body">
          <label className="inspector-field">
            <span>Titre du site</span>
            <input
              value={branding.title}
              onChange={(event) =>
                patchBranding({
                  title: event.currentTarget.value,
                })
              }
            />
          </label>

          <label className="inspector-field">
            <span>Description</span>
            <textarea
              rows={3}
              value={branding.description}
              onChange={(event) =>
                patchBranding({
                  description: event.currentTarget.value,
                })
              }
            />
          </label>

          <label className="chrome-upload">
            <span>Favicon / icône</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading !== null}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void upload('favicon', file);
              }}
            />
          </label>

          {branding.faviconUrl && (
            <div className="chrome-media-preview">
              <img
                src={branding.faviconUrl}
                alt="Aperçu du favicon"
              />
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'site/update',
                    updater: (document) => {
                      const {
                        faviconUrl: _removed,
                        ...nextBranding
                      } = document.branding;

                      return {
                        ...document,
                        branding: nextBranding,
                      };
                    },
                  })
                }
              >
                Retirer
              </button>
            </div>
          )}
        </div>
      </details>

      <details open>
        <summary>Barre de navigation</summary>
        <div className="global-chrome-panel__body">
          <label className="effect-toggle">
            <input
              type="checkbox"
              checked={navigation.visible}
              onChange={(event) =>
                patchNavigation({
                  visible: event.currentTarget.checked,
                })
              }
            />
            <span>Afficher la navigation</span>
          </label>

          <label className="inspector-field">
            <span>Nom / logo texte</span>
            <input
              value={navigation.brandText}
              onChange={(event) =>
                patchNavigation({
                  brandText: event.currentTarget.value,
                })
              }
            />
          </label>

          <label className="chrome-upload">
            <span>Logo image</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading !== null}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void upload('logo', file);
              }}
            />
          </label>

          {navigation.logoUrl && (
            <div className="chrome-media-preview chrome-media-preview--logo">
              <img
                src={navigation.logoUrl}
                alt="Aperçu du logo"
              />
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'site/update',
                    updater: (document) => {
                      const {
                        logoUrl: _removed,
                        ...nextNavigation
                      } = document.navigation;

                      return {
                        ...document,
                        navigation: nextNavigation,
                      };
                    },
                  })
                }
              >
                Retirer
              </button>
            </div>
          )}

          <ColorInput
            label="Fond"
            value={navigation.backgroundColor}
            onChange={(backgroundColor) =>
              patchNavigation({ backgroundColor })
            }
          />
          <ColorInput
            label="Texte"
            value={navigation.textColor}
            onChange={(textColor) =>
              patchNavigation({ textColor })
            }
          />
          <ColorInput
            label="Accent"
            value={navigation.accentColor}
            onChange={(accentColor) =>
              patchNavigation({ accentColor })
            }
          />

          <label className="effect-toggle">
            <input
              type="checkbox"
              checked={navigation.sticky}
              onChange={(event) =>
                patchNavigation({
                  sticky: event.currentTarget.checked,
                })
              }
            />
            <span>Collée en haut</span>
          </label>

          <label className="effect-toggle">
            <input
              type="checkbox"
              checked={navigation.transparent}
              onChange={(event) =>
                patchNavigation({
                  transparent: event.currentTarget.checked,
                })
              }
            />
            <span>Fond translucide</span>
          </label>

          <label className="effect-toggle">
            <input
              type="checkbox"
              checked={navigation.shadow}
              onChange={(event) =>
                patchNavigation({
                  shadow: event.currentTarget.checked,
                })
              }
            />
            <span>Ombre</span>
          </label>

          <label className="inspector-field">
            <span>
              Hauteur {breakpoint}
              <output>
                {navigation.height[breakpoint]}px
              </output>
            </span>
            <input
              type="range"
              min={48}
              max={180}
              value={navigation.height[breakpoint]}
              onChange={(event) =>
                patchNavigation({
                  height: {
                    ...navigation.height,
                    [breakpoint]: Number(
                      event.currentTarget.value,
                    ),
                  },
                })
              }
            />
          </label>

          <label className="inspector-field">
            <span>
              Flou
              <output>{navigation.blur}px</output>
            </span>
            <input
              type="range"
              min={0}
              max={40}
              value={navigation.blur}
              onChange={(event) =>
                patchNavigation({
                  blur: Number(event.currentTarget.value),
                })
              }
            />
          </label>

          <LinkListEditor
            title="Liens de navigation"
            links={navigation.links}
            onChange={(links) => patchNavigation({ links })}
          />
        </div>
      </details>

      <details>
        <summary>Pied de page</summary>
        <div className="global-chrome-panel__body">
          <label className="effect-toggle">
            <input
              type="checkbox"
              checked={footer.visible}
              onChange={(event) =>
                patchFooter({
                  visible: event.currentTarget.checked,
                })
              }
            />
            <span>Afficher le pied de page</span>
          </label>

          <label className="inspector-field">
            <span>Nom</span>
            <input
              value={footer.brandText}
              onChange={(event) =>
                patchFooter({
                  brandText: event.currentTarget.value,
                })
              }
            />
          </label>

          <label className="inspector-field">
            <span>Texte</span>
            <textarea
              rows={3}
              value={footer.body}
              onChange={(event) =>
                patchFooter({
                  body: event.currentTarget.value,
                })
              }
            />
          </label>

          <ColorInput
            label="Fond"
            value={footer.backgroundColor}
            onChange={(backgroundColor) =>
              patchFooter({ backgroundColor })
            }
          />
          <ColorInput
            label="Texte"
            value={footer.textColor}
            onChange={(textColor) =>
              patchFooter({ textColor })
            }
          />
          <ColorInput
            label="Accent"
            value={footer.accentColor}
            onChange={(accentColor) =>
              patchFooter({ accentColor })
            }
          />

          <label className="inspector-field">
            <span>
              Hauteur {breakpoint}
              <output>{footer.height[breakpoint]}px</output>
            </span>
            <input
              type="range"
              min={140}
              max={600}
              value={footer.height[breakpoint]}
              onChange={(event) =>
                patchFooter({
                  height: {
                    ...footer.height,
                    [breakpoint]: Number(
                      event.currentTarget.value,
                    ),
                  },
                })
              }
            />
          </label>

          <LinkListEditor
            title="Liens du pied de page"
            links={footer.links}
            onChange={(links) => patchFooter({ links })}
          />

          <LinkListEditor
            title="Réseaux sociaux"
            links={footer.socialLinks}
            onChange={(socialLinks) =>
              patchFooter({ socialLinks })
            }
          />
        </div>
      </details>

      {message && (
        <p className="chrome-upload-status" role="status">
          {uploading
            ? 'Téléversement...'
            : message}
        </p>
      )}
    </section>
  );
}
