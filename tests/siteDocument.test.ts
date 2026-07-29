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
});
