import { describe, expect, it } from 'vitest';
import { parseSiteDocument } from '../src/editor/model/siteDocument';

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
          visible: true,
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
});
