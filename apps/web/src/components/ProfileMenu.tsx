import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Users } from "lucide-react";

type User = { name: string; email: string; picture?: string };

export function ProfileMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="profile-menu" ref={menuRef}>
      <button
        className="profile-menu-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {user.picture ? (
          <img src={user.picture} alt="" />
        ) : (
          <span className="profile-menu-initial">{user.name.trim().charAt(0).toUpperCase()}</span>
        )}
        <span className="profile-menu-name">{user.name.split(" ")[0]}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="profile-menu-popover" role="menu">
          <div className="profile-menu-account">
            <b>{user.name}</b>
            <small>{user.email}</small>
          </div>
          <a href="/dashboard" role="menuitem" onClick={() => setOpen(false)}>
            <LayoutDashboard size={15} />
            {t("Dashboard")}
          </a>
          <a href="/politician" role="menuitem" onClick={() => setOpen(false)}>
            <Users size={15} />
            {t("Politicians")}
          </a>
          <button type="button" role="menuitem" onClick={onSignOut}>
            <LogOut size={15} />
            {t("Log out")}
          </button>
        </div>
      )}
    </div>
  );
}
