import { describe, expect, it } from 'vitest';
import { getResponsivePlacement, parseSiteDocument } from '../src/editor/model/siteDocument';

const validDocument = {
  schemaVersion: 1,
  siteKit: 'atelierexpression',
  siteKitVersion: '1.0.0',
  pages: [
    {
      id: '8d7ebae2-a337-42d8-b21b-b71bf345a6bf',
      slug: 'home',
      locale: 'fr-CA',
      sections: [
        {
          id: 'home-hero',
          type: 'HeroSection',
          label: 'Hero',
          visible: true,
          height: { desktop: 480, tablet: 460, mobile: 520 },
          props: {},
          scene: [],
        },
      ],
    },
  ],
};

describe('site document contract', () => {
  it('accepts a valid version 1 document', () => {
    expect(parseSiteDocument(validDocument)).toMatchObject(validDocument);
  });

  it('rejects a document with an unsupported schema version', () => {
    expect(() => parseSiteDocument({ ...validDocument, schemaVersion: 2 })).toThrow();
  });

  it('inherits desktop placement and applies a mobile override', () => {
    const placement = getResponsivePlacement(
      {
        desktop: {
          xPercent: 10,
          yPercent: 20,
          widthPercent: 40,
          rotationDegrees: 0,
          zIndex: 2,
          opacity: 1,
          fontSize: 24,
        },
        mobile: { xPercent: 7, widthPercent: 82 },
      },
      'mobile',
    );

    expect(placement).toMatchObject({
      xPercent: 7,
      yPercent: 20,
      widthPercent: 82,
      fontSize: 24,
    });
  });

  it('accepts geometric shapes with shadow and glow effects', () => {
    const page = validDocument.pages[0];
    if (!page) throw new Error('Initial page missing.');

    const section = page.sections[0];
    if (!section) throw new Error('Initial section missing.');

    const document = {
      ...validDocument,
      pages: [
        {
          ...page,
          sections: [
            {
              ...section,
              scene: [
                {
                  id: 'shape-rectangle',
                  sectionId: section.id,
                  type: 'shape',
                  shapeKind: 'rectangle',
                  fillColor: '#E98B5F',
                  strokeColor: '#2B2620',
                  strokeWidth: 2,
                  cornerRadius: 12,
                  placement: {
                    desktop: {
                      xPercent: 50,
                      yPercent: 50,
                      widthPercent: 30,
                      heightPercent: 20,
                      rotationDegrees: 15,
                      zIndex: 4,
                      opacity: 0.9,
                    },
                  },
                  visible: true,
                  locked: false,
                  effects: {
                    shadow: {
                      enabled: true,
                      color: '#000000',
                      offsetX: 0,
                      offsetY: 12,
                      blur: 24,
                      opacity: 0.4,
                    },
                    glow: {
                      enabled: true,
                      color: '#57D9C4',
                      blur: 30,
                      intensity: 0.7,
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const parsed = parseSiteDocument(document);

    expect(parsed.pages[0]?.sections[0]?.scene[0]).toMatchObject({
      type: 'shape',
      shapeKind: 'rectangle',
      fillColor: '#E98B5F',
    });
  });

  it('rejects malformed element colors', () => {
    const page = validDocument.pages[0];
    if (!page) throw new Error('Initial page missing.');

    const section = page.sections[0];
    if (!section) throw new Error('Initial section missing.');

    const document = {
      ...validDocument,
      pages: [
        {
          ...page,
          sections: [
            {
              ...section,
              scene: [
                {
                  id: 'shape-invalid',
                  sectionId: section.id,
                  type: 'shape',
                  shapeKind: 'circle',
                  fillColor: 'orange',
                  strokeColor: '#000000',
                  strokeWidth: 0,
                  cornerRadius: 0,
                  placement: {
                    desktop: {
                      xPercent: 50,
                      yPercent: 50,
                      widthPercent: 20,
                      heightPercent: 20,
                      rotationDegrees: 0,
                      zIndex: 1,
                      opacity: 1,
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

    expect(() => parseSiteDocument(document)).toThrow();
  });

});
describe('site media image contract', () => {
  it('accepts a transparent uploaded image with intrinsic dimensions', () => {
    const page = validDocument.pages[0];

    if (!page) {
      throw new Error('Test page missing.');
    }

    const section = page.sections[0];

    if (!section) {
      throw new Error('Test section missing.');
    }

    const document = {
      ...validDocument,
      pages: [
        {
          ...page,
          sections: [
            {
              ...section,
              scene: [
                {
                  id: 'transparent-bubble',
                  sectionId: section.id,
                  type: 'image',
                  source: {
                    kind: 'url',
                    url: 'https://example.com/bubble.png',
                  },
                  altText: {
                    'fr-CA': 'Bulle transparente',
                  },
                  cornerRadius: 0,
                  aspectRatio: 1.75,
                  fit: 'contain',
                  placement: {
                    desktop: {
                      xPercent: 50,
                      yPercent: 50,
                      widthPercent: 25,
                      rotationDegrees: 0,
                      zIndex: 4,
                      opacity: 1,
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

    const parsed = parseSiteDocument(document);
    const image = parsed.pages[0]?.sections[0]?.scene[0];

    expect(image).toMatchObject({
      type: 'image',
      aspectRatio: 1.75,
      fit: 'contain',
    });
  });
});
