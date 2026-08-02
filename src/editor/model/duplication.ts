import type {
  Placement,
  ResponsivePlacement,
  SceneElement,
  SectionDocument,
  SiteDocument,
} from './siteDocument';

export type DuplicateIdFactory = () => string;

export interface DuplicateElementResult {
  document: SiteDocument;
  element: SceneElement;
}

export interface DuplicateSectionResult {
  document: SiteDocument;
  section: SectionDocument;
}

const DUPLICATE_OFFSET_PERCENT = 2;

function defaultIdFactory(): string {
  return globalThis.crypto.randomUUID().slice(0, 8);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function offsetPartialPlacement(
  placement: Partial<Placement>,
): Partial<Placement> {
  const next = { ...placement };

  if (placement.xPercent !== undefined) {
    next.xPercent = clampPercent(
      placement.xPercent + DUPLICATE_OFFSET_PERCENT,
    );
  }

  if (placement.yPercent !== undefined) {
    next.yPercent = clampPercent(
      placement.yPercent + DUPLICATE_OFFSET_PERCENT,
    );
  }

  return next;
}

function offsetResponsivePlacement(
  placement: ResponsivePlacement,
): ResponsivePlacement {
  const desktop = {
    ...placement.desktop,
    xPercent: clampPercent(
      placement.desktop.xPercent + DUPLICATE_OFFSET_PERCENT,
    ),
    yPercent: clampPercent(
      placement.desktop.yPercent + DUPLICATE_OFFSET_PERCENT,
    ),
  };

  return {
    ...placement,
    desktop,
    ...(placement.tablet
      ? { tablet: offsetPartialPlacement(placement.tablet) }
      : {}),
    ...(placement.mobile
      ? { mobile: offsetPartialPlacement(placement.mobile) }
      : {}),
  };
}

function duplicateElementValue(
  source: SceneElement,
  sectionId: string,
  idFactory: DuplicateIdFactory,
  offset: boolean,
): SceneElement {
  const duplicate = structuredClone(source);

  duplicate.id = `${source.type}-${idFactory()}`;
  duplicate.sectionId = sectionId;

  if (offset) {
    duplicate.placement = offsetResponsivePlacement(
      duplicate.placement,
    );
  }

  return duplicate;
}

export function duplicateElementInDocument(
  document: SiteDocument,
  elementId: string,
  idFactory: DuplicateIdFactory = defaultIdFactory,
): DuplicateElementResult | null {
  for (const page of document.pages) {
    for (const section of page.sections) {
      const sourceIndex = section.scene.findIndex(
        (element) => element.id === elementId,
      );

      if (sourceIndex < 0) continue;

      const source = section.scene[sourceIndex];
      if (!source) return null;

      const duplicate = duplicateElementValue(
        source,
        section.id,
        idFactory,
        true,
      );

      const scene = [...section.scene];
      scene.splice(sourceIndex + 1, 0, duplicate);

      return {
        document: {
          ...document,
          pages: document.pages.map((candidatePage) =>
            candidatePage.id === page.id
              ? {
                  ...candidatePage,
                  sections: candidatePage.sections.map(
                    (candidateSection) =>
                      candidateSection.id === section.id
                        ? {
                            ...candidateSection,
                            scene,
                          }
                        : candidateSection,
                  ),
                }
              : candidatePage,
          ),
        },
        element: duplicate,
      };
    }
  }

  return null;
}

export function duplicateSectionInDocument(
  document: SiteDocument,
  pageId: string,
  sectionId: string,
  idFactory: DuplicateIdFactory = defaultIdFactory,
): DuplicateSectionResult | null {
  const page = document.pages.find(
    (candidate) => candidate.id === pageId,
  );

  if (!page) return null;

  const sourceIndex = page.sections.findIndex(
    (section) => section.id === sectionId,
  );

  if (sourceIndex < 0) return null;

  const source = page.sections[sourceIndex];
  if (!source) return null;

  const duplicateSectionId = `section-${idFactory()}`;
  const duplicate: SectionDocument = {
    ...structuredClone(source),
    id: duplicateSectionId,
    label: `${source.label} — copie`,
    scene: source.scene.map((element) =>
      duplicateElementValue(
        element,
        duplicateSectionId,
        idFactory,
        false,
      ),
    ),
  };

  const sections = [...page.sections];
  sections.splice(sourceIndex + 1, 0, duplicate);

  return {
    document: {
      ...document,
      pages: document.pages.map((candidate) =>
        candidate.id === page.id
          ? {
              ...candidate,
              sections,
            }
          : candidate,
      ),
    },
    section: duplicate,
  };
}
