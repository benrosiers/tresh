import releasePayload from '../data/tresh-release.json';

interface TreshReleasePage {
  id: string;
  slug: string;
  title: string;
  revisionId: string;
  revisionNumber: number;
  schemaVersion: number;
  document: unknown;
  createdAt: string;
}

interface TreshReleasePayload {
  releaseId: string;
  status: string;
  createdAt: string;
  site: {
    id: string;
    slug: string;
    name: string;
    publicUrl: string | null;
  };
  pages: TreshReleasePage[];
}

const release = releasePayload as TreshReleasePayload;

export function getTreshRelease(): TreshReleasePayload {
  return release;
}

export function getTreshPage(slug = 'home'): TreshReleasePage | null {
  return release.pages.find((candidate) => candidate.slug === slug) ?? null;
}
