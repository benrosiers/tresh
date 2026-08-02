import { describe, expect, it } from 'vitest';
import { initialSiteDocument } from '../src/editor/model/initialDocument';
import {
  ensureSiteChrome,
  parseSiteDocument,
} from '../src/editor/model/siteDocument';

describe('global site chrome', () => {
  it('ships with editable branding, navigation, and footer defaults', () => {
    expect(initialSiteDocument.branding.title).toBe(
      'Atelier Expression',
    );
    expect(initialSiteDocument.navigation.links.length).toBeGreaterThan(0);
    expect(initialSiteDocument.footer.visible).toBe(true);
  });

  it('upgrades legacy schema v1 documents without global chrome', () => {
    const {
      branding: _branding,
      navigation: _navigation,
      footer: _footer,
      ...legacy
    } = structuredClone(initialSiteDocument);

    const parsed = parseSiteDocument(legacy);
    const normalized = ensureSiteChrome(parsed);

    expect(normalized.branding.title).toBe('Atelier Expression');
    expect(normalized.navigation.height.desktop).toBe(78);
    expect(normalized.footer.socialLinks[0]?.label).toBe('Instagram');
  });
});
