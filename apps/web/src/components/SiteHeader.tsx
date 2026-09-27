import { LanguageSwitcher } from "./LanguageSwitcher";
import { t } from "../i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Landmark, Menu, X } from "lucide-react";
import "../features/home/HomeHeader.css";

export function SiteHeader({
  children,
  politician = false,
  map = false,
  isSignedIn = false,
}: {
  children?: ReactNode;
  politician?: boolean;
  map?: boolean;
  isSignedIn?: boolean;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const [activeSection, setActiveSection] = useState(window.location.hash || "#home");
  const menuButton = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const update = () =>
      element.parentElement?.style.setProperty(
        "--site-header-height",
        `${element.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateSection = () => setActiveSection(window.location.hash || "#home");
    window.addEventListener("hashchange", updateSection);
    return () => window.removeEventListener("hashchange", updateSection);
  }, []);

  useEffect(() => {
    if (!mobileNav) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNav(false);
        menuButton.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setMobileNav(false);
    };
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outside);
    };
  }, [mobileNav, setMobileNav]);

  const activeHref = map ? "/search-map" : politician ? "/politician" : `/${activeSection}`;
  return (
    <header
      className="header home-header"
      ref={header}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMobileNav(false);
      }}
    >
      <a className="brand" href="/" aria-label={t("Janpratinidhi home")}>
        <span className="brand-mark">
          <Landmark size={20} strokeWidth={2.2} />
        </span>
        <span className="brand-name">
          {t("Jan Pratinidhi")}
          <span>.</span>
        </span>
      </a>
      <button
        ref={menuButton}
        className="mobile-menu icon-button"
        onClick={() => setMobileNav(!mobileNav)}
        aria-label={mobileNav ? t("Close navigation") : t("Open navigation")}
        aria-expanded={mobileNav}
        aria-controls="primary-navigation"
      >
        {mobileNav ? <X /> : <Menu />}
      </button>
      <nav
        id="primary-navigation"
        aria-label={t("Main navigation")}
        className={mobileNav ? "nav-links open" : "nav-links"}
      >
        {[
          { label: "Home", href: "/#home" },
          { label: "About", href: "/#about" },
          { label: "Explore Politician", href: "/politician" },
          { label: "Search Map", href: "/search-map" },
          {
            label: "Found a Bug ?",
            href: "https://github.com/suryacse2019/janpratinidhi/issues/new",
            external: true,
          },
        ]
          .filter(({ href }) => href !== "/search-map" || isSignedIn)
          .map(({ label, href, external }) => (
            <a
              key={href}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className={activeHref === href ? "active" : undefined}
              aria-current={
                activeHref === href ? (politician || map ? "page" : "location") : undefined
              }
              onClick={() => setMobileNav(false)}
            >
              {t(label)}
            </a>
          ))}
      </nav>
      <LanguageSwitcher />
      {children}
    </header>
  );
}
