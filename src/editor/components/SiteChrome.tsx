import type { CSSProperties, MouseEvent } from 'react';
import type {
  Breakpoint,
  SiteFooter,
  SiteNavigation,
} from '../model/siteDocument';

function hexToRgba(color: string, opacity: number): string {
  const normalized = color.replace('#', '');

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(251, 248, 243, ${opacity})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function preventEditorNavigation(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
}

export function SiteNavbarPreview({
  navigation,
  breakpoint,
}: {
  navigation: SiteNavigation;
  breakpoint: Breakpoint;
}) {
  if (!navigation.visible) return null;

  const style: CSSProperties = {
    height: navigation.height[breakpoint],
    color: navigation.textColor,
    background: navigation.transparent
      ? hexToRgba(navigation.backgroundColor, 0.78)
      : navigation.backgroundColor,
    backdropFilter:
      navigation.transparent && navigation.blur > 0
        ? `blur(${navigation.blur}px)`
        : undefined,
    boxShadow: navigation.shadow
      ? '0 10px 28px rgb(43 38 32 / 14%)'
      : undefined,
    position: navigation.sticky ? 'sticky' : 'relative',
    top: navigation.sticky ? 0 : undefined,
    zIndex: 100,
    borderColor: navigation.accentColor,
  };

  return (
    <header
      className={`site-chrome-nav site-chrome-nav--${breakpoint}`}
      style={style}
      data-global-chrome="navigation"
    >
      <a
        className="site-chrome-nav__brand"
        href="#hero"
        onClick={preventEditorNavigation}
      >
        {navigation.logoUrl ? (
          <img
            src={navigation.logoUrl}
            alt={navigation.brandText}
          />
        ) : (
          <span>{navigation.brandText}</span>
        )}
      </a>

      <nav
        className="site-chrome-nav__links"
        aria-label="Navigation globale"
      >
        {navigation.links.map((link) => (
          <a
            href={link.href}
            style={{
              color: navigation.textColor,
              textDecorationColor: navigation.accentColor,
            }}
            onClick={preventEditorNavigation}
            key={link.id}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooterPreview({
  footer,
  breakpoint,
}: {
  footer: SiteFooter;
  breakpoint: Breakpoint;
}) {
  if (!footer.visible) return null;

  return (
    <footer
      className={`site-chrome-footer site-chrome-footer--${breakpoint}`}
      style={{
        minHeight: footer.height[breakpoint],
        color: footer.textColor,
        background: footer.backgroundColor,
        borderColor: footer.accentColor,
      }}
      data-global-chrome="footer"
    >
      <div className="site-chrome-footer__intro">
        <strong>{footer.brandText}</strong>
        <p>{footer.body}</p>
      </div>

      <nav
        className="site-chrome-footer__links"
        aria-label="Liens du pied de page"
      >
        {footer.links.map((link) => (
          <a
            href={link.href}
            style={{ color: footer.textColor }}
            onClick={preventEditorNavigation}
            key={link.id}
          >
            {link.label}
          </a>
        ))}
      </nav>

      <nav
        className="site-chrome-footer__social"
        aria-label="Réseaux sociaux"
      >
        {footer.socialLinks.map((link) => (
          <a
            href={link.href}
            style={{
              color: footer.accentColor,
              borderColor: footer.accentColor,
            }}
            onClick={preventEditorNavigation}
            key={link.id}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
