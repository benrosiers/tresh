import { z } from 'zod';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export type ImageFit = 'cover' | 'contain' | 'fill';

export type TextVariant = 'eyebrow' | 'heading' | 'body';

export type TextFontFamily =
  | 'serif'
  | 'sans'
  | 'mono'
  | 'system';

export type TextFontWeight =
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900;

export type TextFontStyle = 'normal' | 'italic';

export type TextAlignment = 'left' | 'center' | 'right';

export type TextTransform =
  | 'none'
  | 'uppercase'
  | 'lowercase'
  | 'capitalize';

export interface TextTypography {
  color: string;
  fontFamily: TextFontFamily;
  fontWeight: TextFontWeight;
  fontStyle: TextFontStyle;
  textAlign: TextAlignment;
  lineHeight: number;
  letterSpacing: number;
  textTransform: TextTransform;
}

export const DEFAULT_TEXT_TYPOGRAPHY: Record<TextVariant, TextTypography> = {
  eyebrow: {
    color: '#E98B5F',
    fontFamily: 'mono',
    fontWeight: 500,
    fontStyle: 'normal',
    textAlign: 'left',
    lineHeight: 1.08,
    letterSpacing: 0.12,
    textTransform: 'uppercase',
  },
  heading: {
    color: '#2B2620',
    fontFamily: 'serif',
    fontWeight: 600,
    fontStyle: 'italic',
    textAlign: 'left',
    lineHeight: 1.08,
    letterSpacing: -0.035,
    textTransform: 'none',
  },
  body: {
    color: '#2B2620',
    fontFamily: 'serif',
    fontWeight: 300,
    fontStyle: 'normal',
    textAlign: 'left',
    lineHeight: 1.42,
    letterSpacing: 0,
    textTransform: 'none',
  },
};

export function getDefaultTextTypography(
  variant: TextVariant,
): TextTypography {
  return {
    ...DEFAULT_TEXT_TYPOGRAPHY[variant],
  };
}

export function resolveTextTypography(
  element: Pick<TextElement, 'variant' | 'typography'>,
): TextTypography {
  return {
    ...DEFAULT_TEXT_TYPOGRAPHY[element.variant],
    ...(element.typography ?? {}),
  };
}

export type ButtonVariant = 'primary' | 'secondary' | 'text';

export interface ButtonStyle {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  fontFamily: TextFontFamily;
  fontSize: number;
  fontWeight: TextFontWeight;
  hoverBackgroundColor: string;
  hoverTextColor: string;
  hoverBorderColor: string;
}

export const DEFAULT_BUTTON_STYLES: Record<ButtonVariant, ButtonStyle> = {
  primary: {
    backgroundColor: '#FF4E38',
    textColor: '#28150F',
    borderColor: '#FF4E38',
    borderWidth: 0,
    borderRadius: 999,
    fontFamily: 'sans',
    fontSize: 14,
    fontWeight: 700,
    hoverBackgroundColor: '#E63F2D',
    hoverTextColor: '#28150F',
    hoverBorderColor: '#E63F2D',
  },
  secondary: {
    backgroundColor: '#FFFFFF',
    textColor: '#2B2620',
    borderColor: '#2B2620',
    borderWidth: 1,
    borderRadius: 999,
    fontFamily: 'sans',
    fontSize: 14,
    fontWeight: 700,
    hoverBackgroundColor: '#F2C79A',
    hoverTextColor: '#2B2620',
    hoverBorderColor: '#2B2620',
  },
  text: {
    backgroundColor: '#FFFFFF',
    textColor: '#E98B5F',
    borderColor: '#E98B5F',
    borderWidth: 0,
    borderRadius: 0,
    fontFamily: 'sans',
    fontSize: 14,
    fontWeight: 700,
    hoverBackgroundColor: '#FFFFFF',
    hoverTextColor: '#C65E38',
    hoverBorderColor: '#C65E38',
  },
};

export function getDefaultButtonStyle(
  variant: ButtonVariant,
): ButtonStyle {
  return {
    ...DEFAULT_BUTTON_STYLES[variant],
  };
}

export function resolveButtonStyle(
  element: Pick<ButtonElement, 'variant' | 'style'>,
): ButtonStyle {
  return {
    ...DEFAULT_BUTTON_STYLES[element.variant],
    ...(element.style ?? {}),
  };
}

export type ShapeKind =
  | 'rectangle'
  | 'square'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'line';

export interface ElementShadow {
  enabled: boolean;
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  opacity: number;
}

export interface ElementGlow {
  enabled: boolean;
  color: string;
  blur: number;
  intensity: number;
}

export interface ElementEffects {
  shadow?: ElementShadow;
  glow?: ElementGlow;
}

export interface Placement {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent?: number;
  rotationDegrees: number;
  zIndex: number;
  opacity: number;
  fontSize?: number;
  parallaxDepth?: number;
  imageFit?: ImageFit;
  imageFocalX?: number;
  imageFocalY?: number;
}

export interface ResponsivePlacement {
  desktop: Placement;
  tablet?: Partial<Placement>;
  mobile?: Partial<Placement>;
}

export type LocalizedText = Record<string, string>;

export interface SiteLink {
  id: string;
  label: string;
  href: string;
}

export interface SiteBranding {
  title: string;
  description: string;
  faviconUrl?: string;
}

export interface SiteNavigation {
  visible: boolean;
  brandText: string;
  logoUrl?: string;
  links: SiteLink[];
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  sticky: boolean;
  transparent: boolean;
  blur: number;
  shadow: boolean;
  height: Record<Breakpoint, number>;
}

export interface SiteFooter {
  visible: boolean;
  brandText: string;
  body: string;
  links: SiteLink[];
  socialLinks: SiteLink[];
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  height: Record<Breakpoint, number>;
}

export const DEFAULT_SITE_BRANDING: SiteBranding = {
  title: 'Atelier Expression',
  description:
    "Des ateliers d'expression pour adultes qui veulent retrouver ce qui bouge encore en eux.",
};

export const DEFAULT_SITE_NAVIGATION: SiteNavigation = {
  visible: true,
  brandText: 'Atelier Expression',
  links: [
    { id: 'nav-home', label: 'Accueil', href: '#hero' },
    { id: 'nav-manifeste', label: 'Manifeste', href: '#manifeste' },
    { id: 'nav-expression', label: 'Expression', href: '#expression' },
    { id: 'nav-faq', label: 'FAQ', href: '#faq' },
  ],
  backgroundColor: '#FBF8F3',
  textColor: '#2B2620',
  accentColor: '#E98B5F',
  sticky: true,
  transparent: false,
  blur: 14,
  shadow: true,
  height: {
    desktop: 78,
    tablet: 72,
    mobile: 64,
  },
};

export const DEFAULT_SITE_FOOTER: SiteFooter = {
  visible: true,
  brandText: 'Atelier Expression',
  body: 'Des espaces pour jouer, bouger, parler et redevenir pleinement soi.',
  links: [
    { id: 'footer-home', label: 'Accueil', href: '#hero' },
    { id: 'footer-faq', label: 'FAQ', href: '#faq' },
    { id: 'footer-contact', label: 'Contact', href: '/contact' },
  ],
  socialLinks: [
    {
      id: 'footer-instagram',
      label: 'Instagram',
      href: 'https://www.instagram.com/atelier.jeu.expression/',
    },
  ],
  backgroundColor: '#2B2620',
  textColor: '#FBF8F3',
  accentColor: '#E98B5F',
  height: {
    desktop: 250,
    tablet: 270,
    mobile: 330,
  },
};

interface SceneElementBase {
  id: string;
  sectionId: string;
  placement: ResponsivePlacement;
  visible: boolean;
  locked: boolean;
  effects?: ElementEffects;
}

export interface TextElement extends SceneElementBase {
  type: 'text';
  text: LocalizedText;
  variant: TextVariant;
  typography?: Partial<TextTypography>;
}

export interface ImageElement extends SceneElementBase {
  type: 'image';
  source:
    | { kind: 'placeholder'; label: string }
    | {
        kind: 'url';
        url: string;
        fileName?: string;
        storagePath?: string;
        mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
      }
    | { kind: 'media'; mediaAssetId: string };
  altText: LocalizedText;
  cornerRadius: number;
  aspectRatio?: number;
  fit?: ImageFit;
}

export interface PaintElement extends SceneElementBase {
  type: 'paint';
  assetKey: 'coral' | 'rose' | 'peach';
  customColor?: string;
  decorative: true;
}

export interface ButtonElement extends SceneElementBase {
  type: 'button';
  label: LocalizedText;
  href: string;
  variant: ButtonVariant;
  style?: Partial<ButtonStyle>;
  openInNewTab?: boolean;
}

export interface ShapeElement extends SceneElementBase {
  type: 'shape';
  shapeKind: ShapeKind;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  cornerRadius: number;
}

export type SceneElement =
  | TextElement
  | ImageElement
  | PaintElement
  | ButtonElement
  | ShapeElement;

export interface SectionDocument {
  id: string;
  type: string;
  label: string;
  visible: boolean;
  height: Record<Breakpoint, number>;
  props: Record<string, unknown>;
  scene: SceneElement[];
}

export interface PageDocument {
  id: string;
  slug: string;
  locale: string;
  title: string;
  description: string;
  sections: SectionDocument[];
}

export interface SiteDocument {
  schemaVersion: 1;
  siteKit: string;
  siteKitVersion: string;
  branding: SiteBranding;
  navigation: SiteNavigation;
  footer: SiteFooter;
  pages: PageDocument[];
}

const hexColorSchema = z.string().regex(
  /^#[0-9a-fA-F]{6}$/,
  'La couleur doit utiliser le format #RRGGBB.',
);

export const breakpointSchema = z.enum(['desktop', 'tablet', 'mobile']);

export const placementSchema = z.object({
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
  widthPercent: z.number().positive().max(100),
  heightPercent: z.number().positive().max(100).optional(),
  rotationDegrees: z.number().min(-360).max(360).default(0),
  zIndex: z.number().int().min(0).max(100).default(0),
  opacity: z.number().min(0).max(1).default(1),
  fontSize: z.number().min(8).max(160).optional(),
  parallaxDepth: z.number().min(0).max(1).optional(),
  imageFit: z.enum(['cover', 'contain', 'fill']).optional(),
  imageFocalX: z.number().min(0).max(100).optional(),
  imageFocalY: z.number().min(0).max(100).optional(),
});

export const responsivePlacementSchema = z.object({
  desktop: placementSchema,
  tablet: placementSchema.partial().optional(),
  mobile: placementSchema.partial().optional(),
});

const localizedTextSchema = z.record(z.string().min(2), z.string());

const siteLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  href: z.string().min(1),
});

const responsiveHeightSchema = z.object({
  desktop: z.number().int().min(40).max(800),
  tablet: z.number().int().min(40).max(800),
  mobile: z.number().int().min(40).max(900),
});

const siteBrandingSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(320),
  faviconUrl: z.string().url().optional(),
});

const siteNavigationSchema = z.object({
  visible: z.boolean().default(true),
  brandText: z.string().min(1).max(80),
  logoUrl: z.string().url().optional(),
  links: z.array(siteLinkSchema).max(12),
  backgroundColor: hexColorSchema,
  textColor: hexColorSchema,
  accentColor: hexColorSchema,
  sticky: z.boolean().default(true),
  transparent: z.boolean().default(false),
  blur: z.number().min(0).max(40),
  shadow: z.boolean().default(true),
  height: responsiveHeightSchema,
});

const siteFooterSchema = z.object({
  visible: z.boolean().default(true),
  brandText: z.string().min(1).max(80),
  body: z.string().max(320),
  links: z.array(siteLinkSchema).max(12),
  socialLinks: z.array(siteLinkSchema).max(12),
  backgroundColor: hexColorSchema,
  textColor: hexColorSchema,
  accentColor: hexColorSchema,
  height: responsiveHeightSchema,
});

const elementShadowSchema = z.object({
  enabled: z.boolean().default(false),
  color: hexColorSchema.default('#000000'),
  offsetX: z.number().min(-100).max(100),
  offsetY: z.number().min(-100).max(100),
  blur: z.number().min(0).max(160),
  opacity: z.number().min(0).max(1),
});

const elementGlowSchema = z.object({
  enabled: z.boolean().default(false),
  color: hexColorSchema.default('#57D9C4'),
  blur: z.number().min(0).max(160),
  intensity: z.number().min(0).max(1),
});

const elementEffectsSchema = z.object({
  shadow: elementShadowSchema.optional(),
  glow: elementGlowSchema.optional(),
});

const sceneElementBaseSchema = z.object({
  id: z.string().min(1),
  sectionId: z.string().min(1),
  placement: responsivePlacementSchema,
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  effects: elementEffectsSchema.optional(),
});

const textFontWeightSchema = z.union([
  z.literal(300),
  z.literal(400),
  z.literal(500),
  z.literal(600),
  z.literal(700),
  z.literal(800),
  z.literal(900),
]);

const textTypographySchema = z.object({
  color: hexColorSchema,
  fontFamily: z.enum(['serif', 'sans', 'mono', 'system']),
  fontWeight: textFontWeightSchema,
  fontStyle: z.enum(['normal', 'italic']),
  textAlign: z.enum(['left', 'center', 'right']),
  lineHeight: z.number().min(0.6).max(3),
  letterSpacing: z.number().min(-0.2).max(1),
  textTransform: z.enum([
    'none',
    'uppercase',
    'lowercase',
    'capitalize',
  ]),
}).partial();

const textElementSchema = sceneElementBaseSchema.extend({
  type: z.literal('text'),
  text: localizedTextSchema,
  variant: z.enum(['eyebrow', 'heading', 'body']),
  typography: textTypographySchema.optional(),
});

const buttonStyleSchema = z.object({
  backgroundColor: hexColorSchema,
  textColor: hexColorSchema,
  borderColor: hexColorSchema,
  borderWidth: z.number().min(0).max(12),
  borderRadius: z.number().min(0).max(999),
  fontFamily: z.enum(['serif', 'sans', 'mono', 'system']),
  fontSize: z.number().min(8).max(96),
  fontWeight: textFontWeightSchema,
  hoverBackgroundColor: hexColorSchema,
  hoverTextColor: hexColorSchema,
  hoverBorderColor: hexColorSchema,
}).partial();

const imageElementSchema = sceneElementBaseSchema.extend({
  type: z.literal('image'),
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('placeholder'), label: z.string().min(1) }),
    z.object({
      kind: z.literal('url'),
      url: z.string().url(),
      fileName: z.string().min(1).max(512).optional(),
      storagePath: z.string().min(1).max(2048).optional(),
      mimeType: z
        .enum(['image/png', 'image/jpeg', 'image/webp'])
        .optional(),
    }),
    z.object({ kind: z.literal('media'), mediaAssetId: z.string().uuid() }),
  ]),
  altText: localizedTextSchema,
  cornerRadius: z.number().min(0).max(999).default(24),
  aspectRatio: z.number().positive().max(20).optional(),
  fit: z.enum(['cover', 'contain', 'fill']).optional(),
});

const paintElementSchema = sceneElementBaseSchema.extend({
  type: z.literal('paint'),
  assetKey: z.enum(['coral', 'rose', 'peach']),
  customColor: hexColorSchema.optional(),
  decorative: z.literal(true),
});

const buttonElementSchema = sceneElementBaseSchema.extend({
  type: z.literal('button'),
  label: localizedTextSchema,
  href: z.string().startsWith('/').or(z.string().url()),
  variant: z.enum(['primary', 'secondary', 'text']),
  style: buttonStyleSchema.optional(),
  openInNewTab: z.boolean().optional(),
});

const shapeElementSchema = sceneElementBaseSchema.extend({
  type: z.literal('shape'),
  shapeKind: z.enum([
    'rectangle',
    'square',
    'circle',
    'ellipse',
    'triangle',
    'diamond',
    'star',
    'line',
  ]),
  fillColor: hexColorSchema,
  strokeColor: hexColorSchema,
  strokeWidth: z.number().min(0).max(40).default(0),
  cornerRadius: z.number().min(0).max(50).default(0),
});

export const sceneElementSchema = z.discriminatedUnion('type', [
  textElementSchema,
  imageElementSchema,
  paintElementSchema,
  buttonElementSchema,
  shapeElementSchema,
]);

export const sectionDocumentSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  label: z.string().min(1),
  visible: z.boolean().default(true),
  height: z.object({
    desktop: z.number().int().min(160).max(1600),
    tablet: z.number().int().min(160).max(1600),
    mobile: z.number().int().min(160).max(1800),
  }),
  props: z.record(z.string(), z.unknown()).default({}),
  scene: z.array(sceneElementSchema).default([]),
});

export const pageDocumentSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  locale: z.string().min(2),
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(320).optional(),
  sections: z.array(sectionDocumentSchema).min(1),
});

export const siteDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  siteKit: z.string().min(1),
  siteKitVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  branding: siteBrandingSchema.default(DEFAULT_SITE_BRANDING),
  navigation: siteNavigationSchema.default(DEFAULT_SITE_NAVIGATION),
  footer: siteFooterSchema.default(DEFAULT_SITE_FOOTER),
  pages: z.array(pageDocumentSchema).min(1).max(50),
});

function fallbackPageTitle(slug: string): string {
  if (slug === 'home') return 'Accueil';

  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function parseSiteDocument(input: unknown): SiteDocument {
  const parsed = siteDocumentSchema.parse(input) as Omit<
    SiteDocument,
    'pages'
  > & {
    pages: Array<
      Omit<PageDocument, 'title' | 'description'> &
      Partial<Pick<PageDocument, 'title' | 'description'>>
    >;
  };

  return {
    ...parsed,
    pages: parsed.pages.map((page) => ({
      ...page,
      title: page.title?.trim() || fallbackPageTitle(page.slug),
      description: page.description ?? '',
    })),
  };
}

export function getResponsivePlacement(
  placement: ResponsivePlacement,
  breakpoint: Breakpoint,
): Placement {
  if (breakpoint === 'desktop') return placement.desktop;

  return {
    ...placement.desktop,
    ...(placement[breakpoint] ?? {}),
  };
}

export function ensureSiteChrome(document: SiteDocument): SiteDocument {
  const legacy = document as SiteDocument & {
    branding?: Partial<SiteBranding>;
    navigation?: Partial<SiteNavigation>;
    footer?: Partial<SiteFooter>;
  };

  return {
    ...document,
    branding: {
      ...DEFAULT_SITE_BRANDING,
      ...legacy.branding,
    },
    navigation: {
      ...DEFAULT_SITE_NAVIGATION,
      ...legacy.navigation,
      links:
        legacy.navigation?.links ??
        DEFAULT_SITE_NAVIGATION.links.map((link) => ({ ...link })),
      height: {
        ...DEFAULT_SITE_NAVIGATION.height,
        ...legacy.navigation?.height,
      },
    },
    footer: {
      ...DEFAULT_SITE_FOOTER,
      ...legacy.footer,
      links:
        legacy.footer?.links ??
        DEFAULT_SITE_FOOTER.links.map((link) => ({ ...link })),
      socialLinks:
        legacy.footer?.socialLinks ??
        DEFAULT_SITE_FOOTER.socialLinks.map((link) => ({ ...link })),
      height: {
        ...DEFAULT_SITE_FOOTER.height,
        ...legacy.footer?.height,
      },
    },
  };
}
