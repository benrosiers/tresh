import {
  DEFAULT_SITE_BRANDING,
  DEFAULT_SITE_FOOTER,
  DEFAULT_SITE_NAVIGATION,
  type PageDocument,
  type ResponsivePlacement,
  type SceneElement,
  type SiteDocument,
} from './siteDocument';
import { createCanonicalSecondaryPages } from './pageTemplates';

const desktopPlacement = (
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  extras: Partial<ResponsivePlacement['desktop']> = {},
): ResponsivePlacement => ({
  desktop: {
    xPercent,
    yPercent,
    widthPercent,
    rotationDegrees: 0,
    zIndex: 1,
    opacity: 1,
    ...extras,
  },
});

const text = (
  id: string,
  sectionId: string,
  value: string,
  variant: Extract<SceneElement, { type: 'text' }>['variant'],
  placement: ResponsivePlacement,
): SceneElement => ({
  id,
  sectionId,
  type: 'text',
  text: { 'fr-CA': value },
  variant,
  placement,
  visible: true,
  locked: false,
});

const paint = (
  id: string,
  sectionId: string,
  assetKey: Extract<SceneElement, { type: 'paint' }>['assetKey'],
  placement: ResponsivePlacement,
): SceneElement => ({
  id,
  sectionId,
  type: 'paint',
  assetKey,
  decorative: true,
  placement,
  visible: true,
  locked: false,
});

const homePage: PageDocument = {
  id: '8d7ebae2-a337-42d8-b21b-b71bf345a6bf',
  slug: 'home',
  locale: 'fr-CA',
  title: 'Accueil',
  description:
    "Atelier Expression propose des ateliers joyeux pour adultes qui veulent se sentir plus vivants, plus libres et plus présents.",
  sections: [
    {
      id: 'hero',
      type: 'HeroSection',
      label: 'Hero',
      visible: true,
      height: { desktop: 480, tablet: 460, mobile: 520 },
      props: {},
      scene: [
        text('hero-eyebrow', 'hero', 'pour adultes vivants', 'eyebrow', {
          ...desktopPlacement(8, 20, 40, { fontSize: 13, zIndex: 5 }),
          mobile: { xPercent: 7, yPercent: 16, widthPercent: 80, fontSize: 12 },
        }),
        text('hero-title', 'hero', 'Pas performer. Pas survivre.', 'heading', {
          ...desktopPlacement(8, 32, 52, { fontSize: 52, zIndex: 5 }),
          tablet: { xPercent: 7, widthPercent: 58, fontSize: 44 },
          mobile: { xPercent: 7, yPercent: 26, widthPercent: 84, fontSize: 36 },
        }),
        text(
          'hero-body',
          'hero',
          "Des ateliers d'expression pour adultes qui n'ont plus envie de faire semblant.",
          'body',
          {
            ...desktopPlacement(8, 61, 38, { fontSize: 18, zIndex: 5 }),
            tablet: { widthPercent: 46 },
            mobile: { xPercent: 7, yPercent: 56, widthPercent: 82, fontSize: 16 },
          },
        ),
        paint('hero-paint-coral', 'hero', 'coral', {
          ...desktopPlacement(72, 28, 25, {
            rotationDegrees: -7,
            zIndex: 2,
            opacity: 0.95,
            parallaxDepth: 0.18,
          }),
          tablet: { xPercent: 76, widthPercent: 31 },
          mobile: { xPercent: 69, yPercent: 12, widthPercent: 40, rotationDegrees: -3 },
        }),
        paint('hero-paint-rose', 'hero', 'rose', {
          ...desktopPlacement(86, 65, 17, {
            rotationDegrees: 12,
            zIndex: 3,
            opacity: 0.9,
            parallaxDepth: 0.32,
          }),
          mobile: { xPercent: 82, yPercent: 72, widthPercent: 26, rotationDegrees: 8 },
        }),
        paint('hero-paint-peach', 'hero', 'peach', {
          ...desktopPlacement(59, 78, 13, {
            rotationDegrees: -18,
            zIndex: 1,
            opacity: 0.85,
            parallaxDepth: 0.1,
          }),
          mobile: { xPercent: 20, yPercent: 84, widthPercent: 22, rotationDegrees: -10 },
        }),
        {
          id: 'hero-photo',
          sectionId: 'hero',
          type: 'image',
          source: { kind: 'placeholder', label: 'Photo de Cindy' },
          altText: { 'fr-CA': 'Portrait de Cindy' },
          cornerRadius: 34,
          placement: {
            ...desktopPlacement(78, 61, 21, { rotationDegrees: 2, zIndex: 4 }),
            tablet: { xPercent: 78, yPercent: 66, widthPercent: 26 },
            mobile: { xPercent: 57, yPercent: 77, widthPercent: 43, rotationDegrees: 1 },
          },
          visible: true,
          locked: false,
        },
      ],
    },
    {
      id: 'manifeste',
      type: 'ManifestoSection',
      label: 'Manifeste',
      visible: true,
      height: { desktop: 270, tablet: 290, mobile: 340 },
      props: {},
      scene: [
        text('manifeste-title', 'manifeste', 'Le manifeste', 'heading', desktopPlacement(9, 30, 44, { fontSize: 34, zIndex: 4 })),
        text(
          'manifeste-body',
          'manifeste',
          "Ici, on ne vient pas apprendre a mieux jouer un role. On vient retrouver ce qui bouge encore en soi.",
          'body',
          desktopPlacement(9, 53, 56, { fontSize: 18, zIndex: 4 }),
        ),
        paint('manifeste-paint', 'manifeste', 'peach', desktopPlacement(80, 48, 15, { rotationDegrees: 6, opacity: 0.72 })),
      ],
    },
    {
      id: 'expression',
      type: 'ExpressionSection',
      label: 'Expression',
      visible: true,
      height: { desktop: 350, tablet: 390, mobile: 470 },
      props: {},
      scene: [
        text('expr-title', 'expression', "L'expression, pas la performance", 'heading', desktopPlacement(9, 20, 50, { fontSize: 34, zIndex: 4 })),
        text(
          'expr-body',
          'expression',
          "Du jeu, du mouvement, de la parole et la permission d'essayer sans devoir etre parfait.",
          'body',
          desktopPlacement(9, 45, 52, { fontSize: 18, zIndex: 4 }),
        ),
        paint('expr-paint-1', 'expression', 'rose', desktopPlacement(15, 75, 11, { rotationDegrees: 22, opacity: 0.8 })),
        paint('expr-paint-2', 'expression', 'coral', desktopPlacement(88, 20, 14, { rotationDegrees: -14, opacity: 0.85 })),
      ],
    },
    {
      id: 'pourqui',
      type: 'AudienceSection',
      label: 'Pour qui',
      visible: true,
      height: { desktop: 310, tablet: 350, mobile: 430 },
      props: {},
      scene: [
        text('pourqui-title', 'pourqui', 'Pour qui', 'heading', desktopPlacement(9, 23, 42, { fontSize: 34, zIndex: 4 })),
        text(
          'pourqui-body',
          'pourqui',
          "Pour les adultes curieux, sensibles, prudents, exuberants ou fatigues de se retenir.",
          'body',
          desktopPlacement(9, 50, 58, { fontSize: 18, zIndex: 4 }),
        ),
      ],
    },
    {
      id: 'faq',
      type: 'FaqSection',
      label: 'FAQ',
      visible: true,
      height: { desktop: 270, tablet: 310, mobile: 370 },
      props: {},
      scene: [
        text('faq-title', 'faq', 'Questions frequentes', 'heading', desktopPlacement(9, 28, 50, { fontSize: 34, zIndex: 4 })),
        text(
          'faq-body',
          'faq',
          "Pas besoin d'avoir de l'experience. Tu peux participer a ton rythme.",
          'body',
          desktopPlacement(9, 56, 56, { fontSize: 18, zIndex: 4 }),
        ),
      ],
    },
  ],
};

export const initialSiteDocument: SiteDocument = {
  schemaVersion: 1,
  siteKit: 'atelierexpression',
  siteKitVersion: '1.1.0',
  branding: {
    ...DEFAULT_SITE_BRANDING,
  },
  navigation: {
    ...DEFAULT_SITE_NAVIGATION,
    links: DEFAULT_SITE_NAVIGATION.links.map((link) => ({ ...link })),
    height: { ...DEFAULT_SITE_NAVIGATION.height },
  },
  footer: {
    ...DEFAULT_SITE_FOOTER,
    links: DEFAULT_SITE_FOOTER.links.map((link) => ({ ...link })),
    socialLinks: DEFAULT_SITE_FOOTER.socialLinks.map((link) => ({ ...link })),
    height: { ...DEFAULT_SITE_FOOTER.height },
  },
  pages: [homePage, ...createCanonicalSecondaryPages()],
};
