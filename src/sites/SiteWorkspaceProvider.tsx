import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../auth';
import type { SiteDocument } from '../editor/model/siteDocument';
import {
  createAccountSite,
  listAccountSites,
  type TreshSiteSummary,
} from './siteRepository';

export type SiteWorkspaceStatus =
  | 'loading'
  | 'ready'
  | 'error';

interface CreateSiteRequest {
  name: string;
  slug: string;
  document: SiteDocument;
}

interface SiteWorkspaceContextValue {
  status: SiteWorkspaceStatus;
  sites: TreshSiteSummary[];
  activeSite: TreshSiteSummary | null;
  message: string | null;
  selectSite: (siteId: string) => void;
  createSite: (request: CreateSiteRequest) => Promise<TreshSiteSummary>;
  refreshSites: () => Promise<void>;
}

const SiteWorkspaceContext =
  createContext<SiteWorkspaceContextValue | null>(null);

const configuredSiteSlug =
  import.meta.env.VITE_TRESH_SITE_SLUG?.trim() ||
  'atelier-expression';

function activeSiteStorageKey(userId: string): string {
  return `tresh.active-site.${userId}.v1`;
}

function readPreferredSiteId(userId: string): string | null {
  try {
    return window.localStorage.getItem(
      activeSiteStorageKey(userId),
    );
  } catch {
    return null;
  }
}

function writePreferredSiteId(
  userId: string,
  siteId: string,
): void {
  try {
    window.localStorage.setItem(
      activeSiteStorageKey(userId),
      siteId,
    );
  } catch {
    // Le site actif reste utilisable même sans persistance navigateur.
  }
}

function chooseInitialSite(
  sites: TreshSiteSummary[],
  preferredSiteId: string | null,
): TreshSiteSummary | null {
  return (
    sites.find((site) => site.id === preferredSiteId) ??
    sites.find((site) => site.slug === configuredSiteSlug) ??
    sites[0] ??
    null
  );
}

export function SiteWorkspaceProvider({
  children,
}: PropsWithChildren) {
  const { mode, user } = useAuth();
  const [status, setStatus] =
    useState<SiteWorkspaceStatus>('loading');
  const [sites, setSites] = useState<TreshSiteSummary[]>([]);
  const [activeSiteId, setActiveSiteId] =
    useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applySites = useCallback(
    (
      nextSites: TreshSiteSummary[],
      preferredSiteId: string | null,
    ) => {
      setSites(nextSites);

      const active = chooseInitialSite(
        nextSites,
        preferredSiteId,
      );

      setActiveSiteId(active?.id ?? null);

      if (user && active) {
        writePreferredSiteId(user.id, active.id);
      }
    },
    [user],
  );

  const refreshSites = useCallback(async () => {
    if (mode !== 'signed-in' || !user) return;

    setStatus('loading');
    setMessage(null);

    try {
      const nextSites = await listAccountSites();
      const preferred =
        activeSiteId ?? readPreferredSiteId(user.id);

      applySites(nextSites, preferred);
      setStatus('ready');
    } catch (error: unknown) {
      setStatus('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de charger les sites du compte.',
      );
    }
  }, [
    activeSiteId,
    applySites,
    mode,
    user,
  ]);

  useEffect(() => {
    if (mode === 'local') {
      const localSite: TreshSiteSummary = {
        id: 'local-atelier-expression',
        slug: configuredSiteSlug,
        name: 'Atelier Expression',
        publicUrl: null,
        updatedAt: Date.now(),
      };

      setSites([localSite]);
      setActiveSiteId(localSite.id);
      setMessage(null);
      setStatus('ready');
      return;
    }

    if (mode !== 'signed-in' || !user) {
      setSites([]);
      setActiveSiteId(null);
      setMessage(null);
      setStatus(
        mode === 'loading'
          ? 'loading'
          : 'ready',
      );
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setMessage(null);

    void listAccountSites()
      .then((nextSites) => {
        if (cancelled) return;

        applySites(
          nextSites,
          readPreferredSiteId(user.id),
        );
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        setSites([]);
        setActiveSiteId(null);
        setStatus('error');
        setMessage(
          error instanceof Error
            ? error.message
            : 'Impossible de charger les sites du compte.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [applySites, mode, user]);

  const selectSite = useCallback(
    (siteId: string) => {
      const site = sites.find(
        (candidate) => candidate.id === siteId,
      );

      if (!site) return;

      setActiveSiteId(site.id);
      setMessage(null);

      if (user) {
        writePreferredSiteId(user.id, site.id);
      }
    },
    [sites, user],
  );

  const createSite = useCallback(
    async (
      request: CreateSiteRequest,
    ): Promise<TreshSiteSummary> => {
      if (mode !== 'signed-in' || !user) {
        throw new Error(
          'Connecte-toi à Tresh pour créer un site associé à ton compte.',
        );
      }

      const created = await createAccountSite(request);
      const nextSite: TreshSiteSummary = {
        id: created.id,
        slug: created.slug,
        name: created.name,
        publicUrl: created.publicUrl,
        updatedAt: created.updatedAt,
      };

      setSites((current) => [
        nextSite,
        ...current.filter(
          (site) => site.id !== nextSite.id,
        ),
      ]);
      setActiveSiteId(nextSite.id);
      writePreferredSiteId(user.id, nextSite.id);
      setMessage(null);
      setStatus('ready');

      return nextSite;
    },
    [mode, user],
  );

  const activeSite = useMemo(
    () =>
      sites.find(
        (site) => site.id === activeSiteId,
      ) ?? null,
    [activeSiteId, sites],
  );

  const value = useMemo(
    () => ({
      status,
      sites,
      activeSite,
      message,
      selectSite,
      createSite,
      refreshSites,
    }),
    [
      status,
      sites,
      activeSite,
      message,
      selectSite,
      createSite,
      refreshSites,
    ],
  );

  return (
    <SiteWorkspaceContext.Provider value={value}>
      {children}
    </SiteWorkspaceContext.Provider>
  );
}

export function useSiteWorkspace(): SiteWorkspaceContextValue {
  const context = useContext(SiteWorkspaceContext);

  if (!context) {
    throw new Error(
      'useSiteWorkspace must be used inside SiteWorkspaceProvider',
    );
  }

  return context;
}
