import type {
  ResponsivePlacement,
  SceneElement,
  SiteDocument,
} from '../editor/model/siteDocument';

function placement(
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  extras: Partial<ResponsivePlacement['desktop']> = {},
): ResponsivePlacement {
  return {
    desktop: {
      xPercent,
      yPercent,
      widthPercent,
      rotationDegrees: 0,
      zIndex: 1,
      opacity: 1,
      ...extras,
    },
  };
}

function text(
  id: string,
  sectionId: string,
  value: string,
  variant: Extract<SceneElement, { type: 'text' }>['variant'],
  responsivePlacement: ResponsivePlacement,
): SceneElement {
  return {
    id,
    sectionId,
    type: 'text',
    text: { 'fr-CA': value },
    variant,
    placement: responsivePlacement,
    visible: true,
    locked: false,
  };
}

export function createBlankSiteDocument(name: string): SiteDocument {
  const normalizedName = name.trim() || 'Nouveau site';
  const pageId = crypto.randomUUID();
  const sectionId = `hero-${crypto.randomUUID().slice(0, 8)}`;

  return {
    schemaVersion: 1,
    siteKit: 'tresh-blank',
    siteKitVersion: '1.0.0',
    branding: {
      title: normalizedName,
      description: `Le site ${normalizedName}, créé avec Tresh.`,
    },
    navigation: {
      visible: true,
      brandText: normalizedName,
      links: [
        {
          id: `nav-home-${crypto.randomUUID().slice(0, 8)}`,
          label: 'Accueil',
          href: '/',
        },
      ],
      backgroundColor: '#F7F3EC',
      textColor: '#24211D',
      accentColor: '#E98B5F',
      sticky: true,
      transparent: false,
      blur: 14,
      shadow: true,
      height: {
        desktop: 76,
        tablet: 70,
        mobile: 62,
      },
    },
    footer: {
      visible: true,
      brandText: normalizedName,
      body: 'Un site créé avec Tresh.',
      links: [
        {
          id: `footer-home-${crypto.randomUUID().slice(0, 8)}`,
          label: 'Accueil',
          href: '/',
        },
      ],
      socialLinks: [],
      backgroundColor: '#24211D',
      textColor: '#F7F3EC',
      accentColor: '#E98B5F',
      height: {
        desktop: 220,
        tablet: 240,
        mobile: 280,
      },
    },
    pages: [
      {
        id: pageId,
        slug: 'home',
        locale: 'fr-CA',
        title: 'Accueil',
        description: `Page d’accueil de ${normalizedName}.`,
        sections: [
          {
            id: sectionId,
            type: 'FreeformSection',
            label: 'Accueil',
            visible: true,
            height: {
              desktop: 620,
              tablet: 620,
              mobile: 680,
            },
            props: {},
            scene: [
              text(
                `eyebrow-${crypto.randomUUID().slice(0, 8)}`,
                sectionId,
                'NOUVEAU SITE',
                'eyebrow',
                {
                  ...placement(12, 24, 40, {
                    fontSize: 13,
                    zIndex: 3,
                  }),
                  mobile: {
                    xPercent: 8,
                    yPercent: 20,
                    widthPercent: 78,
                  },
                },
              ),
              text(
                `title-${crypto.randomUUID().slice(0, 8)}`,
                sectionId,
                normalizedName,
                'heading',
                {
                  ...placement(12, 39, 64, {
                    fontSize: 58,
                    zIndex: 3,
                  }),
                  tablet: {
                    widthPercent: 70,
                    fontSize: 48,
                  },
                  mobile: {
                    xPercent: 8,
                    yPercent: 36,
                    widthPercent: 84,
                    fontSize: 38,
                  },
                },
              ),
              text(
                `body-${crypto.randomUUID().slice(0, 8)}`,
                sectionId,
                'Ajoute ton contenu, tes images et tes sections à partir de cette base.',
                'body',
                {
                  ...placement(12, 58, 48, {
                    fontSize: 19,
                    zIndex: 3,
                  }),
                  mobile: {
                    xPercent: 8,
                    yPercent: 57,
                    widthPercent: 84,
                    fontSize: 17,
                  },
                },
              ),
              {
                id: `shape-${crypto.randomUUID().slice(0, 8)}`,
                sectionId,
                type: 'shape',
                shapeKind: 'circle',
                fillColor: '#E98B5F',
                strokeColor: '#E98B5F',
                strokeWidth: 0,
                cornerRadius: 0,
                placement: {
                  ...placement(78, 48, 26, {
                    heightPercent: 26,
                    zIndex: 1,
                    opacity: 0.88,
                  }),
                  mobile: {
                    xPercent: 72,
                    yPercent: 78,
                    widthPercent: 38,
                    heightPercent: 38,
                  },
                },
                visible: true,
                locked: false,
              },
            ],
          },
        ],
      },
    ],
  };
}

export function cloneSiteDocumentForNewSite(
  source: SiteDocument,
  name: string,
): SiteDocument {
  const clone = structuredClone(source);
  const normalizedName = name.trim() || `${source.branding.title} — copie`;

  return {
    ...clone,
    siteKit:
      source.siteKit === 'atelierexpression'
        ? 'tresh-clone'
        : source.siteKit,
    branding: {
      ...clone.branding,
      title: normalizedName,
    },
    navigation: {
      ...clone.navigation,
      brandText: normalizedName,
    },
    footer: {
      ...clone.footer,
      brandText: normalizedName,
    },
  };
}
