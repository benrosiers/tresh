import { z } from 'zod';

export const breakpointSchema = z.enum(['desktop', 'tablet', 'mobile']);
export type Breakpoint = z.infer<typeof breakpointSchema>;

const placementSchema = z.object({
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
  widthPercent: z.number().positive().max(100),
  rotationDegrees: z.number().min(-360).max(360).default(0),
  zIndex: z.number().int().min(0).max(100).default(0),
  opacity: z.number().min(0).max(1).default(1),
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
  mediaAssetId: z.string().uuid(),
  altText: localizedTextSchema,
});

const paintElementSchema = sceneElementBaseSchema.extend({
  type: z.literal('paint'),
  mediaAssetId: z.string().uuid(),
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
  visible: z.boolean().default(true),
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

export type ResponsivePlacement = z.infer<typeof responsivePlacementSchema>;
export type SceneElement = z.infer<typeof sceneElementSchema>;
export type SectionDocument = z.infer<typeof sectionDocumentSchema>;
export type PageDocument = z.infer<typeof pageDocumentSchema>;
export type SiteDocument = z.infer<typeof siteDocumentSchema>;

export function parseSiteDocument(input: unknown): SiteDocument {
  return siteDocumentSchema.parse(input);
}
