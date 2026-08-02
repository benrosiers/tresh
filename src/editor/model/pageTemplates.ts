import type {
  PageDocument,
  ResponsivePlacement,
  SceneElement,
  SiteDocument,
} from './siteDocument';

interface PageDefinition {
  id: string;
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  introduction: string;
  contentTitle: string;
  contentBody: string;
  contentType: string;
  ctaTitle: string;
  ctaBody: string;
  ctaLabel: string;
  ctaHref: string;
}

const CANONICAL_DEFINITIONS: PageDefinition[] = [
  {
    id: 'd71c9e15-0a27-4a9a-8d0d-2e1dc56b0001',
    slug: 'ateliers',
    title: 'Ateliers',
    description:
      "Découvre les ateliers d'expression corporelle, de prise de parole et de dépassement de soi proposés par Atelier Expression.",
    eyebrow: 'jouer pour vrai',
    heading: 'Des ateliers pour bouger, parler et respirer plus grand.',
    introduction:
      "Chaque atelier crée un espace simple, vivant et sécurisant pour essayer sans devoir être parfait.",
    contentTitle: 'Des formats qui laissent de la place',
    contentBody:
      "Expression corporelle, voix, présence, confiance et connexion. Les exercices s'adaptent au groupe et chacun participe à son rythme.",
    contentType: 'WorkshopCatalogSection',
    ctaTitle: 'Trouve ton prochain atelier',
    ctaBody:
      "Consulte les prochaines dates ou inscris-toi pour être averti dès qu'une nouvelle rencontre est annoncée.",
    ctaLabel: 'Voir les disponibilités',
    ctaHref: '/reserver',
  },
  {
    id: 'd71c9e15-0a27-4a9a-8d0d-2e1dc56b0002',
    slug: 'parcours',
    title: 'Parcours',
    description:
      "Explore les parcours Atelier Expression pour développer ta présence, ta confiance et ta liberté d'expression au fil de plusieurs rencontres.",
    eyebrow: 'avancer ensemble',
    heading: 'Un parcours pour aller plus loin, une étape à la fois.',
    introduction:
      "Les parcours réunissent plusieurs ateliers afin de laisser le temps au corps, à la voix et à la confiance de s'installer.",
    contentTitle: 'Une progression douce et concrète',
    contentBody:
      "Chaque rencontre reprend les acquis précédents, ouvre une nouvelle porte et transforme les prises de conscience en expériences vécues.",
    contentType: 'ProgramPathSection',
    ctaTitle: 'Découvrir le prochain parcours',
    ctaBody:
      "Les groupes restent petits pour préserver la qualité des échanges et la sécurité du processus.",
    ctaLabel: 'Voir les parcours',
    ctaHref: '/parcours',
  },
  {
    id: 'd71c9e15-0a27-4a9a-8d0d-2e1dc56b0003',
    slug: 'evenements',
    title: 'Événements',
    description:
      "Retrouve les événements, rencontres spéciales et collaborations d'Atelier Expression à Montréal et sur la Rive-Sud.",
    eyebrow: 'sortir du quotidien',
    heading: 'Des événements pour créer du mouvement entre nous.',
    introduction:
      "Rencontres thématiques, collaborations et expériences ponctuelles : chaque événement propose une autre façon de se rencontrer.",
    contentTitle: 'Prochains événements',
    contentBody:
      "Les annonces, lieux, horaires et détails d'inscription apparaîtront ici dès qu'ils seront confirmés.",
    contentType: 'EventsFeedSection',
    ctaTitle: 'Ne manque pas la prochaine date',
    ctaBody:
      "Rejoins la communauté pour recevoir les nouvelles et les invitations en premier.",
    ctaLabel: 'Rejoindre la communauté',
    ctaHref: '/communaute',
  },
  {
    id: 'd71c9e15-0a27-4a9a-8d0d-2e1dc56b0004',
    slug: 'a-propos',
    title: 'À propos',
    description:
      "Découvre Cindy Brunet, la vision d'Atelier Expression et l'approche humaine derrière les ateliers.",
    eyebrow: 'derrière les ateliers',
    heading: 'Créer des espaces où on peut enfin arrêter de se rapetisser.',
    introduction:
      "Atelier Expression est né d'une envie simple : remettre du jeu, du corps, de la parole et de la présence dans nos vies d'adultes.",
    contentTitle: 'Une approche sensible, joyeuse et incarnée',
    contentBody:
      "Ici, personne ne doit impressionner. On explore avec curiosité, humour et respect des limites de chacun.",
    contentType: 'AboutApproachSection',
    ctaTitle: 'Rencontrer l’univers Atelier Expression',
    ctaBody:
      "Découvre les ateliers, les valeurs et la communauté qui prennent forme autour de cette démarche.",
    ctaLabel: 'Découvrir les ateliers',
    ctaHref: '/ateliers',
  },
  {
    id: 'd71c9e15-0a27-4a9a-8d0d-2e1dc56b0005',
    slug: 'faq',
    title: 'FAQ',
    description:
      "Réponses aux questions fréquentes sur les ateliers, la participation, l'accessibilité, les inscriptions et le déroulement.",
    eyebrow: 'avant de venir',
    heading: 'Tes questions sont les bienvenues.',
    introduction:
      "Tu n'as pas besoin d'expérience, de talent particulier ni d'être extraverti pour participer.",
    contentTitle: 'Questions fréquentes',
    contentBody:
      "Comment se déroule un atelier? Puis-je participer à mon rythme? Que dois-je apporter? Les réponses détaillées seront regroupées ici.",
    contentType: 'FaqListSection',
    ctaTitle: 'Une question reste sans réponse?',
    ctaBody:
      "Écris-nous simplement. Nous te répondrons avec plaisir et sans pression.",
    ctaLabel: 'Nous contacter',
    ctaHref: '/contact',
  },
  {
    id: 'd71c9e15-0a27-4a9a-8d0d-2e1dc56b0006',
    slug: 'contact',
    title: 'Contact',
    description:
      "Communique avec Atelier Expression pour poser une question, proposer une collaboration ou parler d'un atelier privé.",
    eyebrow: 'on se parle',
    heading: 'Une question, une idée ou une envie de collaborer?',
    introduction:
      "Écris-nous. Un message simple suffit pour commencer la conversation.",
    contentTitle: 'Formulaire de contact',
    contentBody:
      "Le formulaire public conservera son fonctionnement sécurisé. Tresh contrôle le contenu et la présentation autour de celui-ci.",
    contentType: 'ContactFormSection',
    ctaTitle: 'Autres façons de nous joindre',
    ctaBody:
      "Tu peux aussi suivre Atelier Expression sur les réseaux sociaux pour voir les nouvelles et les coulisses.",
    ctaLabel: 'Voir la communauté',
    ctaHref: '/communaute',
  },
  {
    id: 'd71c9e15-0a27-4a9a-8d0d-2e1dc56b0007',
    slug: 'reserver',
    title: 'Réserver',
    description:
      "Réserve ta place à un atelier Atelier Expression et consulte les prochaines disponibilités.",
    eyebrow: 'prendre sa place',
    heading: 'Réserve ta place quand le prochain atelier te parle.',
    introduction:
      "Les groupes sont volontairement petits. Les disponibilités et le statut des inscriptions seront toujours affichés clairement.",
    contentTitle: 'Inscription et disponibilités',
    contentBody:
      "Le module de réservation public restera relié aux vraies dates et aux places disponibles. Tresh contrôle son contexte visuel et éditorial.",
    contentType: 'ReservationSection',
    ctaTitle: 'Besoin de vérifier quelque chose avant?',
    ctaBody:
      "Consulte la FAQ ou écris-nous avant de réserver. Il n'y a aucune mauvaise question.",
    ctaLabel: 'Consulter la FAQ',
    ctaHref: '/faq',
  },
  {
    id: 'd71c9e15-0a27-4a9a-8d0d-2e1dc56b0008',
    slug: 'communaute',
    title: 'Communauté',
    description:
      "Rejoins la communauté Atelier Expression et reste au courant des ateliers, événements et nouvelles.",
    eyebrow: 'rester reliés',
    heading: 'Une communauté pour continuer à se choisir entre les ateliers.',
    introduction:
      "Les rencontres ne s'arrêtent pas toujours à la porte du local. La communauté garde le lien vivant.",
    contentTitle: 'Nouvelles, échanges et invitations',
    contentBody:
      "Retrouve ici les façons de suivre le projet, de participer aux conversations et de recevoir les prochaines annonces.",
    contentType: 'CommunitySection',
    ctaTitle: 'Entre dans la boucle',
    ctaBody:
      "Choisis le canal qui te convient et garde seulement le niveau de contact qui te fait du bien.",
    ctaLabel: 'Voir les événements',
    ctaHref: '/evenements',
  },
  {
    id: 'd71c9e15-0a27-4a9a-8d0d-2e1dc56b0009',
    slug: 'temoignages',
    title: 'Témoignages',
    description:
      "Lis les témoignages de personnes ayant participé aux ateliers et parcours Atelier Expression.",
    eyebrow: 'leurs mots',
    heading: 'Ce que les participants ont vécu, avec leurs propres mots.',
    introduction:
      "Les témoignages parlent de présence, de surprise, de confiance et de petites permissions qui continuent après l'atelier.",
    contentTitle: 'Paroles de participants',
    contentBody:
      "Les témoignages approuvés seront présentés ici avec soin, sans exagération et dans le respect de la confidentialité.",
    contentType: 'TestimonialsSection',
    ctaTitle: 'Vivre ta propre expérience',
    ctaBody:
      "Découvre les prochains ateliers et choisis celui qui correspond à ton rythme.",
    ctaLabel: 'Voir les ateliers',
    ctaHref: '/ateliers',
  },
  {
    id: 'd71c9e15-0a27-4a9a-8d0d-2e1dc56b0010',
    slug: 'ressources',
    title: 'Ressources',
    description:
      "Découvre les textes, exercices et ressources d'Atelier Expression pour prolonger l'exploration entre les rencontres.",
    eyebrow: 'continuer chez soi',
    heading: 'Des ressources simples pour garder le mouvement vivant.',
    introduction:
      "Textes, exercices courts et pistes de réflexion : prends ce qui t'aide et laisse le reste.",
    contentTitle: 'Bibliothèque de ressources',
    contentBody:
      "Les contenus publiés seront regroupés ici par thème afin de rester faciles à retrouver et à partager.",
    contentType: 'ResourcesSection',
    ctaTitle: 'Recevoir les prochaines ressources',
    ctaBody:
      "Rejoins la communauté pour être averti lorsqu'un nouveau contenu est publié.",
    ctaLabel: 'Rejoindre la communauté',
    ctaHref: '/communaute',
  },
];

export const CANONICAL_PAGE_SLUGS = [
  'home',
  ...CANONICAL_DEFINITIONS.map((definition) => definition.slug),
] as const;

const desktopPlacement = (
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  extras: Partial<ResponsivePlacement['desktop']> = {},
): ResponsivePlacement => ({
  desktop: {
    xPercent,
    yPercent,
    widthPercent,
    rotationDegrees: 0,
    zIndex: 4,
    opacity: 1,
    ...extras,
  },
});

function textElement(
  id: string,
  sectionId: string,
  value: string,
  variant: Extract<SceneElement, { type: 'text' }>['variant'],
  placement: ResponsivePlacement,
): SceneElement {
  return {
    id,
    sectionId,
    type: 'text',
    text: { 'fr-CA': value },
    variant,
    placement,
    visible: true,
    locked: false,
  };
}

function paintElement(
  id: string,
  sectionId: string,
  assetKey: Extract<SceneElement, { type: 'paint' }>['assetKey'],
  placement: ResponsivePlacement,
): SceneElement {
  return {
    id,
    sectionId,
    type: 'paint',
    assetKey,
    decorative: true,
    placement,
    visible: true,
    locked: false,
  };
}

function buttonElement(
  id: string,
  sectionId: string,
  label: string,
  href: string,
  placement: ResponsivePlacement,
): SceneElement {
  return {
    id,
    sectionId,
    type: 'button',
    label: { 'fr-CA': label },
    href,
    variant: 'primary',
    placement,
    visible: true,
    locked: false,
  };
}

function createPageFromDefinition(definition: PageDefinition): PageDocument {
  const heroId = `${definition.slug}-hero`;
  const contentId = `${definition.slug}-content`;
  const ctaId = `${definition.slug}-cta`;

  return {
    id: definition.id,
    slug: definition.slug,
    locale: 'fr-CA',
    title: definition.title,
    description: definition.description,
    sections: [
      {
        id: heroId,
        type: 'HeroSection',
        label: 'Introduction',
        visible: true,
        height: { desktop: 420, tablet: 450, mobile: 520 },
        props: {},
        scene: [
          textElement(
            `${heroId}-eyebrow`,
            heroId,
            definition.eyebrow,
            'eyebrow',
            {
              ...desktopPlacement(9, 19, 42, {
                fontSize: 13,
                zIndex: 6,
              }),
              mobile: {
                xPercent: 8,
                yPercent: 16,
                widthPercent: 80,
                fontSize: 12,
              },
            },
          ),
          textElement(
            `${heroId}-title`,
            heroId,
            definition.heading,
            'heading',
            {
              ...desktopPlacement(9, 36, 58, {
                fontSize: 46,
                zIndex: 6,
              }),
              tablet: {
                widthPercent: 64,
                fontSize: 40,
              },
              mobile: {
                xPercent: 8,
                yPercent: 31,
                widthPercent: 84,
                fontSize: 34,
              },
            },
          ),
          textElement(
            `${heroId}-body`,
            heroId,
            definition.introduction,
            'body',
            {
              ...desktopPlacement(9, 68, 48, {
                fontSize: 18,
                zIndex: 6,
              }),
              tablet: {
                widthPercent: 56,
              },
              mobile: {
                xPercent: 8,
                yPercent: 64,
                widthPercent: 84,
                fontSize: 16,
              },
            },
          ),
          paintElement(
            `${heroId}-paint-coral`,
            heroId,
            'coral',
            {
              ...desktopPlacement(79, 31, 24, {
                rotationDegrees: -8,
                zIndex: 2,
                opacity: 0.88,
                parallaxDepth: 0.18,
              }),
              mobile: {
                xPercent: 78,
                yPercent: 14,
                widthPercent: 34,
              },
            },
          ),
          paintElement(
            `${heroId}-paint-rose`,
            heroId,
            'rose',
            {
              ...desktopPlacement(88, 72, 15, {
                rotationDegrees: 12,
                zIndex: 3,
                opacity: 0.82,
                parallaxDepth: 0.3,
              }),
              mobile: {
                xPercent: 84,
                yPercent: 82,
                widthPercent: 24,
              },
            },
          ),
        ],
      },
      {
        id: contentId,
        type: definition.contentType,
        label: definition.contentTitle,
        visible: true,
        height: { desktop: 360, tablet: 400, mobile: 480 },
        props: {
          source: definition.contentType,
        },
        scene: [
          textElement(
            `${contentId}-title`,
            contentId,
            definition.contentTitle,
            'heading',
            {
              ...desktopPlacement(10, 27, 52, {
                fontSize: 36,
                zIndex: 5,
              }),
              mobile: {
                xPercent: 8,
                yPercent: 23,
                widthPercent: 84,
                fontSize: 31,
              },
            },
          ),
          textElement(
            `${contentId}-body`,
            contentId,
            definition.contentBody,
            'body',
            {
              ...desktopPlacement(10, 58, 58, {
                fontSize: 18,
                zIndex: 5,
              }),
              mobile: {
                xPercent: 8,
                yPercent: 56,
                widthPercent: 84,
                fontSize: 16,
              },
            },
          ),
          paintElement(
            `${contentId}-paint`,
            contentId,
            'peach',
            {
              ...desktopPlacement(84, 53, 18, {
                rotationDegrees: 7,
                zIndex: 2,
                opacity: 0.68,
              }),
              mobile: {
                xPercent: 82,
                yPercent: 82,
                widthPercent: 25,
              },
            },
          ),
        ],
      },
      {
        id: ctaId,
        type: 'CallToActionSection',
        label: 'Appel à l’action',
        visible: true,
        height: { desktop: 290, tablet: 330, mobile: 400 },
        props: {},
        scene: [
          textElement(
            `${ctaId}-title`,
            ctaId,
            definition.ctaTitle,
            'heading',
            {
              ...desktopPlacement(10, 25, 56, {
                fontSize: 34,
                zIndex: 5,
              }),
              mobile: {
                xPercent: 8,
                yPercent: 22,
                widthPercent: 84,
                fontSize: 30,
              },
            },
          ),
          textElement(
            `${ctaId}-body`,
            ctaId,
            definition.ctaBody,
            'body',
            {
              ...desktopPlacement(10, 51, 52, {
                fontSize: 17,
                zIndex: 5,
              }),
              mobile: {
                xPercent: 8,
                yPercent: 49,
                widthPercent: 84,
                fontSize: 16,
              },
            },
          ),
          buttonElement(
            `${ctaId}-button`,
            ctaId,
            definition.ctaLabel,
            definition.ctaHref,
            {
              ...desktopPlacement(10, 75, 24, {
                zIndex: 6,
              }),
              mobile: {
                xPercent: 8,
                yPercent: 76,
                widthPercent: 58,
              },
            },
          ),
          paintElement(
            `${ctaId}-paint`,
            ctaId,
            'rose',
            {
              ...desktopPlacement(84, 45, 16, {
                rotationDegrees: -12,
                zIndex: 2,
                opacity: 0.76,
              }),
              mobile: {
                xPercent: 84,
                yPercent: 76,
                widthPercent: 23,
              },
            },
          ),
        ],
      },
    ],
  };
}

export function createCanonicalSecondaryPages(): PageDocument[] {
  return CANONICAL_DEFINITIONS.map((definition) =>
    createPageFromDefinition(definition),
  );
}

function humanizeSlug(slug: string): string {
  if (slug === 'home') return 'Accueil';

  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function slugifyPageTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function makeUniquePageSlug(
  requested: string,
  pages: PageDocument[],
  excludedPageId?: string,
): string {
  const base = slugifyPageTitle(requested) || 'nouvelle-page';
  const used = new Set(
    pages
      .filter((page) => page.id !== excludedPageId)
      .map((page) => page.slug),
  );

  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

function createBlankSection(slug: string): PageDocument['sections'][number] {
  const suffix = crypto.randomUUID().slice(0, 8);
  const sectionId = `${slug}-section-${suffix}`;

  return {
    id: sectionId,
    type: 'FreeformSection',
    label: 'Introduction',
    visible: true,
    height: { desktop: 420, tablet: 450, mobile: 520 },
    props: {},
    scene: [
      textElement(
        `${sectionId}-title`,
        sectionId,
        'Nouvelle page',
        'heading',
        {
          ...desktopPlacement(10, 34, 58, {
            fontSize: 44,
            zIndex: 5,
          }),
          mobile: {
            xPercent: 8,
            yPercent: 30,
            widthPercent: 84,
            fontSize: 34,
          },
        },
      ),
      textElement(
        `${sectionId}-body`,
        sectionId,
        'Ajoute ton contenu, tes images et tes sections depuis Tresh.',
        'body',
        {
          ...desktopPlacement(10, 62, 52, {
            fontSize: 18,
            zIndex: 5,
          }),
          mobile: {
            xPercent: 8,
            yPercent: 59,
            widthPercent: 84,
            fontSize: 16,
          },
        },
      ),
      paintElement(
        `${sectionId}-paint`,
        sectionId,
        'coral',
        desktopPlacement(82, 38, 22, {
          rotationDegrees: -9,
          zIndex: 2,
          opacity: 0.84,
        }),
      ),
    ],
  };
}

export function createBlankPage(
  pages: PageDocument[],
  requestedTitle = 'Nouvelle page',
): PageDocument {
  const title = requestedTitle.trim() || 'Nouvelle page';
  const slug = makeUniquePageSlug(title, pages);
  const page = {
    id: crypto.randomUUID(),
    slug,
    locale: 'fr-CA',
    title,
    description: '',
    sections: [createBlankSection(slug)],
  };

  const titleElement = page.sections[0]?.scene.find(
    (element) =>
      element.type === 'text' &&
      element.variant === 'heading',
  );

  if (titleElement?.type === 'text') {
    titleElement.text['fr-CA'] = title;
  }

  return page;
}

export function duplicatePageDocument(
  source: PageDocument,
  pages: PageDocument[],
): PageDocument {
  const slug = makeUniquePageSlug(`${source.slug}-copie`, pages);
  const clone = structuredClone(source);
  clone.id = crypto.randomUUID();
  clone.slug = slug;
  clone.title = `${source.title} — copie`;

  clone.sections = clone.sections.map((section, sectionIndex) => {
    const sectionId = `${slug}-section-${sectionIndex + 1}-${crypto
      .randomUUID()
      .slice(0, 6)}`;

    return {
      ...section,
      id: sectionId,
      scene: section.scene.map((element) => ({
        ...element,
        id: `${element.type}-${crypto.randomUUID().slice(0, 8)}`,
        sectionId,
      })),
    };
  });

  return clone;
}

function isLegacyHomeNavigation(document: SiteDocument): boolean {
  const ids = document.navigation.links.map((link) => link.id).join('|');
  return ids === 'nav-home|nav-manifeste|nav-expression|nav-faq';
}

function isLegacyFooterNavigation(document: SiteDocument): boolean {
  const ids = document.footer.links.map((link) => link.id).join('|');
  return ids === 'footer-home|footer-faq|footer-contact';
}

function versionParts(value: string): [number, number, number] {
  const [major = 0, minor = 0, patch = 0] = value
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);

  return [major, minor, patch];
}

function isBeforeMultipageVersion(value: string): boolean {
  const current = versionParts(value);
  const target: [number, number, number] = [1, 1, 0];

  for (let index = 0; index < target.length; index += 1) {
    const currentPart = current[index] ?? 0;
    const targetPart = target[index] ?? 0;

    if (currentPart < targetPart) return true;
    if (currentPart > targetPart) return false;
  }

  return false;
}

export function ensureCanonicalPages(document: SiteDocument): SiteDocument {
  const canonicalPages = createCanonicalSecondaryPages();
  const requiresMigration = isBeforeMultipageVersion(
    document.siteKitVersion,
  );
  const metadata = new Map(
    canonicalPages.map((page) => [page.slug, page]),
  );

  const normalizedPages = document.pages.map((page) => {
    const fallback = metadata.get(page.slug);

    return {
      ...page,
      title:
        page.title?.trim() ||
        fallback?.title ||
        humanizeSlug(page.slug),
      description:
        page.description?.trim() ||
        fallback?.description ||
        (page.slug === 'home'
          ? document.branding.description
          : ''),
    };
  });

  const existingSlugs = new Set(
    normalizedPages.map((page) => page.slug),
  );

  const missingPages = requiresMigration
    ? canonicalPages.filter(
        (page) => !existingSlugs.has(page.slug),
      )
    : [];

  const navigation =
    requiresMigration && isLegacyHomeNavigation(document)
    ? {
        ...document.navigation,
        links: [
          { id: 'nav-home', label: 'Accueil', href: '/' },
          { id: 'nav-ateliers', label: 'Ateliers', href: '/ateliers' },
          { id: 'nav-parcours', label: 'Parcours', href: '/parcours' },
          {
            id: 'nav-evenements',
            label: 'Événements',
            href: '/evenements',
          },
          { id: 'nav-about', label: 'À propos', href: '/a-propos' },
          { id: 'nav-faq', label: 'FAQ', href: '/faq' },
          { id: 'nav-contact', label: 'Contact', href: '/contact' },
        ],
      }
    : document.navigation;

  const footer =
    requiresMigration && isLegacyFooterNavigation(document)
    ? {
        ...document.footer,
        links: [
          { id: 'footer-home', label: 'Accueil', href: '/' },
          {
            id: 'footer-ateliers',
            label: 'Ateliers',
            href: '/ateliers',
          },
          {
            id: 'footer-about',
            label: 'À propos',
            href: '/a-propos',
          },
          { id: 'footer-faq', label: 'FAQ', href: '/faq' },
          {
            id: 'footer-contact',
            label: 'Contact',
            href: '/contact',
          },
        ],
      }
    : document.footer;

  return {
    ...document,
    siteKitVersion: requiresMigration
      ? '1.1.0'
      : document.siteKitVersion,
    navigation,
    footer,
    pages: [...normalizedPages, ...missingPages],
  };
}
