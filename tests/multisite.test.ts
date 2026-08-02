import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  getLocalDraftKey,
} from '../src/drafts/draftRepository';
import {
  cloneSiteDocumentForNewSite,
  createBlankSiteDocument,
} from '../src/sites/siteTemplates';
import {
  normalizeSiteSlug,
} from '../src/sites/siteRepository';
import {
  parseSiteDocument,
} from '../src/editor/model/siteDocument';

describe('Tresh multisite boundaries', () => {
  it('creates a valid independent blank site document', () => {
    const document = createBlankSiteDocument(
      'Studio Nord',
    );

    expect(() => parseSiteDocument(document)).not.toThrow();
    expect(document.siteKit).toBe('tresh-blank');
    expect(document.branding.title).toBe('Studio Nord');
    expect(document.pages).toHaveLength(1);
    expect(document.pages[0]?.slug).toBe('home');
  });

  it('duplicates a document without mutating the source', () => {
    const source = createBlankSiteDocument(
      'Original',
    );
    const duplicate = cloneSiteDocumentForNewSite(
      source,
      'Copie',
    );

    expect(source.branding.title).toBe('Original');
    expect(duplicate.branding.title).toBe('Copie');
    expect(duplicate).not.toBe(source);
    expect(duplicate.pages).not.toBe(source.pages);
  });

  it('normalizes account site slugs', () => {
    expect(
      normalizeSiteSlug('École Créative Montréal!'),
    ).toBe('ecole-creative-montreal');
  });

  it('uses a different local draft key per account and site', () => {
    const first = getLocalDraftKey({
      accountId: '11111111-1111-4111-8111-111111111111',
      siteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      siteSlug: 'alpha',
    });
    const second = getLocalDraftKey({
      accountId: '11111111-1111-4111-8111-111111111111',
      siteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      siteSlug: 'beta',
    });
    const otherAccount = getLocalDraftKey({
      accountId: '22222222-2222-4222-8222-222222222222',
      siteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      siteSlug: 'alpha',
    });

    expect(first).not.toBe(second);
    expect(first).not.toBe(otherAccount);
  });
});
