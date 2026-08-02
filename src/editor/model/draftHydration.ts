import type { SiteDocument } from './siteDocument';

export function shouldPreserveEditsDuringHydration(
  baseDocument: SiteDocument,
  currentDocument: SiteDocument,
  baseDirty: boolean,
  currentDirty: boolean,
): boolean {
  return (
    currentDocument !== baseDocument ||
    currentDirty !== baseDirty
  );
}
