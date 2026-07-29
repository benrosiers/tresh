import { z } from 'zod';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export interface Placement {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  rotationDegrees: number;
  zIndex: number;
  opacity: number;
  fontSize?: number;
  parallaxDepth?: number;
}

export interface ResponsivePlacement {
  desktop: Placement;
  tablet?: Partial<Placement>;
  mobile?: Partial<Placement>;
}

export type LocalizedText = Record<string, string>;

interface SceneElementBase {
  id: string;
  sectionId: string;
  placement: ResponsivePlacement;
  visible: boolean;
  locked: boolean;
}

export interface TextElement extends SceneElementBase {
  type: 'text';
  text: LocalizedText;
  variant: 'eyebrow' | 'heading' | 'body';
}

export interface ImageElement extends SceneElementBase {
  type: 'image';
  source:
    | { kind: 'placeholder'; label: string }
    | { kind: 'url'; url: string }
    | { kind: 'media'; mediaAssetId: string };
  altText: LocalizedText;
  cornerRadius: number;
}

export interface PaintElement extends SceneElementBase {
  type: 'paint';
  assetKey: 'coral' | 'rose' | 'peach';
  decorative: true;
}

export interface ButtonElement extends SceneElementBase {
  type: 'button';
  label: LocalizedText;
  href: string;
  variant: 'primary' | 'secondary' | 'text';
}

export type SceneElement = TextElement | ImageElement | PaintElement | ButtonElement;

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
  sections: SectionDocument[];
}

export interface SiteDocument {
  schemaVersion: 1;
  siteKit: string;
  siteKitVersion: string;
  pages: PageDocument[];
}

export const breakpointSchema = z.enum(['desktop', 'tablet', 'mobile']);

export const placementSchema = z.object({
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
  widthPercent: z.number().positive().max(100),
  rotationDegrees: z.number().min(-360).max(360).default(0),
  zIndex: z.number().int().min(0).max(100).default(0),
  opacity: z.number().min(0).max(1).default(1),
  fontSize: z.number().min(8).max(160).optional(),
  parallaxDepth: z.number().min(0).max(1).optional(),
});

export const responsivePlacementSchema = z.object({
  desktop: placementSchema,
  tablet: placementSchema.partial().optional(),
  mobile: placementSchema.partial().optional(),
});

const localizedTextSchema = z.record(z.string().min(2), z.string());

const sceneElementBaseSchema = z.object({
  id: z.string().min(1),
  sectionId: z.string().min(1),
  placement: responsivePlacementSchema,
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
});

const textElementSchema = sceneElementBaseSchema.extend({
  type: z.literal('text'),
  text: localizedTextSchema,
  variant: z.enum(['eyebrow', 'heading', 'body']),
});

const imageElementSchema = sceneElementBaseSchema.extend({
  type: z.literal('image'),
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('placeholder'), label: z.string().min(1) }),
    z.object({ kind: z.literal('url'), url: z.string().url() }),
    z.object({ kind: z.literal('media'), mediaAssetId: z.string().uuid() }),
  ]),
  altText: localizedTextSchema,
  cornerRadius: z.number().min(0).max(999).default(24),
});

const paintElementSchema = sceneElementBaseSchema.extend({
  type: z.literal('paint'),
  assetKey: z.enum(['coral', 'rose', 'peach']),
  decorative: z.literal(true),
});

const buttonElementSchema = sceneElementBaseSchema.extend({
  type: z.literal('button'),
  label: localizedTextSchema,
  href: z.string().startsWith('/').or(z.string().url()),
  variant: z.enum(['primary', 'secondary', 'text']),
});

export const sceneElementSchema = z.discriminatedUnion('type', [
  textElementSchema,
  imageElementSchema,
  paintElementSchema,
  buttonElementSchema,
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
  sections: z.array(sectionDocumentSchema),
});

export const siteDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  siteKit: z.string().min(1),
  siteKitVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  pages: z.array(pageDocumentSchema),
});

export function parseSiteDocument(input: unknown): SiteDocument {
  return siteDocumentSchema.parse(input) as SiteDocument;
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
