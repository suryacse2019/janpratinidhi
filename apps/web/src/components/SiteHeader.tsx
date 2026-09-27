import { useEffect, useRef, useState, type ReactNode } from "react";
import { Landmark, Menu, X } from "lucide-react";
import "../features/home/HomeHeader.css";

export function SiteHeader({
  children,
  politician = false,
}: {
  children?: ReactNode;
  politician?: boolean;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const [activeSection, setActiveSection] = useState(window.location.hash || "#home");
  const menuButton = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);

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

  const activeHref = politician ? "/politician" : `/${activeSection}`;
  return (
    <header
      className="header home-header"
      ref={header}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMobileNav(false);
      }}
    >
      <a className="brand" href="/" aria-label="Janpratinidhi home">
        <span className="brand-mark">
          <Landmark size={20} strokeWidth={2.2} />
        </span>
        <span className="brand-name">
          Jan Pratinidhi<span>.</span>
        </span>
      </a>
      <button
        ref={menuButton}
        className="mobile-menu icon-button"
        onClick={() => setMobileNav(!mobileNav)}
        aria-label={mobileNav ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileNav}
        aria-controls="primary-navigation"
      >
        {mobileNav ? <X /> : <Menu />}
      </button>
      <nav
        id="primary-navigation"
        aria-label="Main navigation"
        className={mobileNav ? "nav-links open" : "nav-links"}
      >
        {[
          { label: "Home", href: "/#home" },
          { label: "About", href: "/#about" },
          { label: "Explore Politician", href: "/politician" },
          { label: "Contribute", href: "/#contribute" },
          {
            label: "Found a Bug ?",
            href: "https://github.com/suryacse2019/janpratinidhi/issues/new",
            external: true,
          },
        ].map(({ label, href, external }) => (
          <a
            key={href}
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className={activeHref === href ? "active" : undefined}
            aria-current={activeHref === href ? (politician ? "page" : "location") : undefined}
            onClick={() => setMobileNav(false)}
          >
            {label}
          </a>
        ))}
      </nav>
      {children}
    </header>
  );
}
