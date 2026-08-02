import { describe, expect, it } from 'vitest';
import {
  shouldPreserveEditsDuringHydration,
} from '../src/editor/model/draftHydration';
import type {
  SiteDocument,
} from '../src/editor/model/siteDocument';

const document = {
  schemaVersion: 1,
  siteKit: 'atelierexpression',
  siteKitVersion: '1.0.0',
  pages: [],
} as unknown as SiteDocument;

describe('Tresh draft hydration guard', () => {
  it('allows hydration when no edit occurred', () => {
    expect(
      shouldPreserveEditsDuringHydration(
        document,
        document,
        false,
        false,
      ),
    ).toBe(false);
  });

  it('preserves a document changed while cloud loading was in flight', () => {
    expect(
      shouldPreserveEditsDuringHydration(
        document,
        {
          ...document,
          pages: [...document.pages],
        },
        false,
        true,
      ),
    ).toBe(true);
  });

  it('preserves a dirty-state transition even with the same document reference', () => {
    expect(
      shouldPreserveEditsDuringHydration(
        document,
        document,
        false,
        true,
      ),
    ).toBe(true);
  });
});
