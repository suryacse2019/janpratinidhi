import { t, useLanguage } from "./i18n";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Landmark, LogOut, ShieldCheck, X } from "lucide-react";
import { API_URL, GOOGLE_CLIENT_ID } from "./shared/config";
import type {
  AdminRepresentative,
  AdminStats,
  AdminUser,
  Gender,
  GoogleCredential,
  Profile,
  User,
} from "./shared/types";
import { normalizeRepresentative } from "./features/representatives/normalizeRepresentative";
import { resolveRoute } from "./routes";
import { PublicPoliticianPage, ThemeToggle } from "./features/directory/PublicPoliticianPage";
import { DashboardLoginGate, UserDashboardPage } from "./features/dashboard/UserDashboardPage";
import {
  RepresentativeDetailsPage,
  RepresentativeSearchCard,
  RepresentativeAvatar,
} from "./features/representatives/RepresentativeFeatures";
import { AdminLoginForm, AdminPanel } from "./features/admin/AdminFeatures";
import { HomePage } from "./features/home/HomePage";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredential) => void;
          }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

async function adminRequest(path: string, init: RequestInit = {}) {
  const token = sessionStorage.getItem("janpratinidhi-admin-token");
  if (!token) throw new Error("Your admin session expired. Sign in again.");
  const response = await fetch(`${API_URL}/admin${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Admin request failed");
  return body;
}

function App() {
  useLanguage();
  const route = resolveRoute(window.location.pathname);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileTotal, setProfileTotal] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("janpratinidhi-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem("janpratinidhi-user");
      return saved ? (JSON.parse(saved) as User) : null;
    } catch {
      return null;
    }
  });
  const [pendingProfile, setPendingProfile] = useState<User | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(() =>
    Boolean(sessionStorage.getItem("janpratinidhi-admin-token")),
  );
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminRepresentatives, setAdminRepresentatives] = useState<AdminRepresentative[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats>({
    users: 0,
    representatives: 0,
    published: 0,
    drafts: 0,
    todayVisitors: 0,
    dailyVisitors: [],
  });
  const [adminLoading, setAdminLoading] = useState(false);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const key = "janpratinidhi-daily-visitor";
      const saved = JSON.parse(localStorage.getItem(key) ?? "null") as {
        day?: string;
        visitorId?: string;
        countedDay?: string;
      } | null;
      if (saved?.day === today && saved.countedDay === today && saved.visitorId) return;
      const visitorId =
        saved?.day === today && saved.visitorId
          ? saved.visitorId
          : typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
                const random = (Math.random() * 16) | 0;
                return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
              });
      void fetch(`${API_URL}/analytics/visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId }),
        keepalive: true,
      })
        .then((response) => {
          if (response.ok)
            localStorage.setItem(key, JSON.stringify({ day: today, visitorId, countedDay: today }));
        })
        .catch(() => undefined);
    } catch {
      /* Analytics are optional and must not interrupt the website. */
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#141715" : "#f6f5f1");
    try {
      localStorage.setItem("janpratinidhi-theme", theme);
    } catch {
      /* Theme still works for this session. */
    }
  }, [theme]);
  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  useEffect(() => {
    let active = true;
    if (route.name === "admin" || route.name === "directory" || route.name === "map")
      return () => {
        active = false;
      };
    fetch(`${API_URL}/representatives?page=1&limit=8`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { data: Array<Record<string, unknown>>; pagination?: { total: number } }) => {
        if (!active) return;
        const records = body.data.map(normalizeRepresentative);
        setProfiles(records);
        setProfileTotal(body.pagination?.total ?? records.length);
      })
      .catch(() => {
        if (active) setProfiles([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const credential = sessionStorage.getItem("janpratinidhi-google-token");
    if (!credential) {
      sessionStorage.removeItem("janpratinidhi-user");
      setUser(null);
      return;
    }
    let active = true;
    const verifySession = () =>
      fetch(`${API_URL}/auth/user/session`, { headers: { Authorization: `Bearer ${credential}` } })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error ?? "Your session expired");
          if (active) {
            setUser(body.user);
            sessionStorage.setItem("janpratinidhi-user", JSON.stringify(body.user));
          }
        })
        .catch(() => {
          if (active) {
            sessionStorage.removeItem("janpratinidhi-user");
            sessionStorage.removeItem("janpratinidhi-google-token");
            setUser(null);
          }
        });
    void verifySession();
    const timer = window.setInterval(() => {
      void verifySession();
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || route.name === "admin") return;
    const credential = sessionStorage.getItem("janpratinidhi-google-token");
    if (!credential) return;
    const page = route.name;
    void fetch(`${API_URL}/activity/page-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${credential}` },
      body: JSON.stringify({ page }),
      keepalive: true,
    }).catch(() => undefined);
  }, [user?.id, route.name, route.name === "representative" ? route.identifier : ""]);

  const signIn = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setNotice("Google sign-in needs VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID configuration.");
      return;
    }
    setAuthBusy(true);
    try {
      const google = window.google;
      if (!google) throw new Error("Google sign-in is still loading. Please try again.");
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          try {
            const response = await fetch(`${API_URL}/auth/google`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential }),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error ?? "Google sign-in failed");
            if (!body.user.profileComplete) {
              sessionStorage.setItem("janpratinidhi-pending-google-token", credential);
              setPendingProfile(body.user);
            } else {
              setUser(body.user);
              sessionStorage.setItem("janpratinidhi-user", JSON.stringify(body.user));
              sessionStorage.setItem("janpratinidhi-google-token", credential);
              setNotice(t("Signed in as {name}", { name: body.user.name }));
            }
          } catch (error) {
            setNotice(error instanceof Error ? error.message : "Google sign-in failed");
          } finally {
            setAuthBusy(false);
          }
        },
      });
      google.accounts.id.prompt();
    } catch (error) {
      setAuthBusy(false);
      setNotice(error instanceof Error ? error.message : "Google sign-in failed");
    }
  };
  const signOut = () => {
    sessionStorage.removeItem("janpratinidhi-user");
    sessionStorage.removeItem("janpratinidhi-google-token");
    setUser(null);
    setNotice("You have been signed out");
  };

  const completeUserProfile = async (profile: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    gender: Gender;
  }) => {
    const credential = sessionStorage.getItem("janpratinidhi-pending-google-token");
    if (!credential)
      throw new Error("Google sign-in expired. Sign in again to finish your profile.");
    setProfileBusy(true);
    try {
      const response = await fetch(`${API_URL}/auth/complete-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, credential }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save your profile");
      setUser(body.user);
      sessionStorage.setItem("janpratinidhi-user", JSON.stringify(body.user));
      sessionStorage.setItem("janpratinidhi-google-token", credential);
      sessionStorage.removeItem("janpratinidhi-pending-google-token");
      setPendingProfile(null);
      setNotice(t("Welcome, {name}", { name: body.user.firstName }));
    } catch (error) {
      throw error;
    } finally {
      setProfileBusy(false);
    }
  };

  const openAdmin = async () => {
    setAdminOpen(true);
    setAdminLoading(true);
    try {
      const token = sessionStorage.getItem("janpratinidhi-admin-token");
      if (!token) {
        setAdminAuthenticated(false);
        setAdminOpen(false);
        throw new Error("Sign in with the admin email and password to continue.");
      }
      const headers = { Authorization: `Bearer ${token}` };
      const [usersResponse, repsResponse, statsResponse] = await Promise.all([
        fetch(`${API_URL}/admin/users`, { headers }),
        fetch(`${API_URL}/admin/representatives`, { headers }),
        fetch(`${API_URL}/admin/dashboard`, { headers }),
      ]);
      const [usersBody, repsBody, statsBody] = await Promise.all([
        usersResponse.json(),
        repsResponse.json(),
        statsResponse.json(),
      ]);
      const failed = [usersResponse, repsResponse, statsResponse].find((response) => !response.ok);
      if (failed) {
        if (failed.status === 401) {
          sessionStorage.removeItem("janpratinidhi-admin-token");
          setAdminAuthenticated(false);
          setAdminOpen(false);
        }
        throw new Error(
          [usersBody, repsBody, statsBody][
            [usersResponse, repsResponse, statsResponse].indexOf(failed)
          ]?.error ?? "Could not load admin dashboard",
        );
      }
      setAdminUsers(usersBody.data);
      setAdminRepresentatives(repsBody.data);
      setAdminStats(statsBody.stats);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load admin dashboard");
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (route.name === "admin" && adminAuthenticated) void openAdmin();
  }, []);

  const signInAdmin = async (email: string, password: string) => {
    setAdminBusy(true);
    try {
      const response = await fetch(`${API_URL}/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Admin sign-in failed");
      sessionStorage.setItem("janpratinidhi-admin-token", body.token);
      setAdminAuthenticated(true);
      setNotice("Admin sign-in successful");
      await openAdmin();
    } catch (error) {
      throw error;
    } finally {
      setAdminBusy(false);
    }
  };

  const adminSignOut = () => {
    sessionStorage.removeItem("janpratinidhi-admin-token");
    setAdminAuthenticated(false);
    setAdminOpen(false);
    setAdminUsers([]);
    setAdminRepresentatives([]);
    setNotice("Admin signed out");
  };

  const setAccountStatus = async (account: AdminUser, status: "active" | "inactive") => {
    try {
      await adminRequest(`/users/${account._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await openAdmin();
      setNotice(t(status === "active" ? "User activated" : "User deactivated"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update user");
    }
  };
  const deleteAccount = async (account: AdminUser) => {
    if (
      !window.confirm(
        t("Delete {name}'s account? They will not be able to sign in again.", {
          name: account.name,
        }),
      )
    )
      return;
    try {
      await adminRequest(`/users/${account._id}`, { method: "DELETE" });
      await openAdmin();
      setNotice("User account deleted");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete user");
    }
  };

  const toggleSave = (id: string) => {
    setSaved((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    setNotice(saved.includes(id) ? "Removed from your saved list" : "Saved for later");
    window.setTimeout(() => setNotice(""), 2200);
  };

  if (route.name === "admin")
    return (
      <div className="admin-route-shell">
        <header className="admin-route-header">
          <a className="brand" href="/" aria-label={t("Janpratinidhi home")}>
            <span className="brand-mark">
              <Landmark size={19} />
            </span>
            <span className="brand-name">
              {t("Jan Pratinidhi")}
              <span>.</span> <small>{t("ADMIN")}</small>
            </span>
          </a>
          <div className="theme-header-actions">
            <LanguageSwitcher />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <a className="admin-return-link" href="/">
              {t("View public website") + " "}
              <ArrowUpRight size={14} />
            </a>
          </div>
        </header>
        {adminAuthenticated ? (
          adminOpen ? (
            <AdminPanel
              apiUrl={API_URL}
              users={adminUsers}
              stats={adminStats}
              representatives={adminRepresentatives}
              loading={adminLoading}
              onRefresh={openAdmin}
              onNotice={setNotice}
              onClose={() => window.location.assign("/")}
              onSignOut={adminSignOut}
              onStatusChange={setAccountStatus}
              onDeleteUser={deleteAccount}
            />
          ) : (
            <div className="admin-route-loading">{t("Loading admin dashboard…")}</div>
          )
        ) : (
          <div className="admin-route-login">
            <div className="admin-route-intro">
              <span className="admin-login-icon">
                <ShieldCheck size={23} />
              </span>
              <div className="eyebrow small-eyebrow">{t("JANPRATINIDHI ADMIN")}</div>
              <h1>{t("Manage your public directory.")}</h1>
              <p>
                {t(
                  "Sign in with your administrator credentials to manage representative records and review user accounts.",
                )}
              </p>
              <a href="/" className="admin-return-link">
                {t("← Return to public website")}
              </a>
            </div>
            <AdminLoginForm busy={adminBusy} onSubmit={signInAdmin} />
          </div>
        )}
        {notice && (
          <div className="toast">
            <Check size={16} />
            {t(notice)}
            <button onClick={() => setNotice("")} aria-label={t("Dismiss")}>
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    );
  if (route.name === "directory" || route.name === "map")
    return (
      <PublicPoliticianPage
        isSignedIn={Boolean(user)}
        key={route.name}
        mapMode={route.name === "map"}
        theme={theme}
        onToggleTheme={toggleTheme}
        apiUrl={API_URL}
        normalizeRepresentative={normalizeRepresentative}
        renderCard={(person) => <RepresentativeSearchCard person={person} apiUrl={API_URL} />}
      />
    );
  if (route.name === "representative")
    return (
      <RepresentativeDetailsPage
        isSignedIn={Boolean(user)}
        identifier={route.identifier}
        theme={theme}
        onToggleTheme={toggleTheme}
        apiUrl={API_URL}
        normalizeRepresentative={normalizeRepresentative}
      />
    );
  if (route.name === "dashboard")
    return user ? (
      <UserDashboardPage
        user={user}
        onSignOut={signOut}
        theme={theme}
        onToggleTheme={toggleTheme}
        apiUrl={API_URL}
        normalizeRepresentative={normalizeRepresentative}
        renderCard={(person) => <RepresentativeSearchCard person={person} apiUrl={API_URL} />}
      />
    ) : (
      <DashboardLoginGate theme={theme} onToggleTheme={toggleTheme} />
    );

  return (
    <HomePage
      profiles={profiles}
      profileTotal={profileTotal}
      theme={theme}
      toggleTheme={toggleTheme}
      user={user}
      signOut={signOut}
      signIn={signIn}
      authBusy={authBusy}
      notice={t(notice)}
      setNotice={setNotice}
      selected={selected}
      setSelected={setSelected}
      toggleSave={toggleSave}
      saved={saved}
      pendingProfile={pendingProfile}
      profileBusy={profileBusy}
      completeUserProfile={completeUserProfile}
      apiUrl={API_URL}
    />
  );
}

export default App;
