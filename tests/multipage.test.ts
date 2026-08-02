import { describe, expect, it } from 'vitest';
import { initialSiteDocument } from '../src/editor/model/initialDocument';
import {
  CANONICAL_PAGE_SLUGS,
  createBlankPage,
  duplicatePageDocument,
  ensureCanonicalPages,
} from '../src/editor/model/pageTemplates';

describe('Tresh multipage V1', () => {
  it('ships the complete canonical Atelier Expression page set', () => {
    expect(
      initialSiteDocument.pages.map((page) => page.slug),
    ).toEqual([...CANONICAL_PAGE_SLUGS]);

    expect(initialSiteDocument.pages).toHaveLength(11);

    for (const page of initialSiteDocument.pages) {
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.description.length).toBeGreaterThan(0);
      expect(page.sections.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('adds missing canonical pages without replacing the edited home page', () => {
    const document = structuredClone(initialSiteDocument);
    const home = document.pages[0];

    if (!home) throw new Error('Home page missing.');

    home.title = 'Accueil personnalisé';
    document.siteKitVersion = '1.0.0';
    document.pages = [home];

    const result = ensureCanonicalPages(document);

    expect(result.pages).toHaveLength(11);
    expect(result.pages[0]?.title).toBe('Accueil personnalisé');
    expect(result.pages.map((page) => page.slug)).toEqual([
      ...CANONICAL_PAGE_SLUGS,
    ]);
  });

  it('does not recreate a deliberately removed page after migration', () => {
    const document = structuredClone(initialSiteDocument);
    document.pages = document.pages.filter(
      (page) => page.slug !== 'ressources',
    );

    const result = ensureCanonicalPages(document);

    expect(
      result.pages.some((page) => page.slug === 'ressources'),
    ).toBe(false);
  });

  it('creates unique slugs for new pages', () => {
    const first = createBlankPage(
      initialSiteDocument.pages,
      'Nouvelle page',
    );

    const second = createBlankPage(
      [...initialSiteDocument.pages, first],
      'Nouvelle page',
    );

    expect(first.slug).toBe('nouvelle-page');
    expect(second.slug).toBe('nouvelle-page-2');
    expect(first.id).not.toBe(second.id);
  });

  it('duplicates a page with fresh page, section, and element ids', () => {
    const source = initialSiteDocument.pages[1];

    if (!source) throw new Error('Source page missing.');

    const duplicate = duplicatePageDocument(
      source,
      initialSiteDocument.pages,
    );

    const sourceSectionIds = new Set(
      source.sections.map((section) => section.id),
    );
    const sourceElementIds = new Set(
      source.sections.flatMap((section) =>
        section.scene.map((element) => element.id),
      ),
    );

    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.slug).not.toBe(source.slug);
    expect(
      duplicate.sections.some((section) =>
        sourceSectionIds.has(section.id),
      ),
    ).toBe(false);
    expect(
      duplicate.sections.some((section) =>
        section.scene.some((element) =>
          sourceElementIds.has(element.id),
        ),
      ),
    ).toBe(false);

    for (const section of duplicate.sections) {
      for (const element of section.scene) {
        expect(element.sectionId).toBe(section.id);
      }
    }
  });
});
