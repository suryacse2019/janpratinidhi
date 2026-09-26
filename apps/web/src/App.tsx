import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Bookmark, Check, CircleHelp, ExternalLink, FileText, Landmark, Menu, Moon, Search, ShieldCheck, Sparkles, Sun, Vote, X, LogOut } from "lucide-react";
import type { Representative } from "@janpratinidhi/shared";

type Profile = Representative;
const filters = ["All representatives", "Lok Sabha MP", "Rajya Sabha MP", "MLA", "MLC"];
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
type Gender = "female" | "male" | "non_binary" | "prefer_not_to_say";
type User = { id: string; email: string; name: string; picture?: string; firstName?: string; lastName?: string; phoneNumber?: string; gender?: Gender; profileComplete?: boolean; status?: "active" | "inactive" | "deleted" };
type AdminUser = { _id: string; email: string; name: string; picture?: string; firstName?: string; lastName?: string; phoneNumber?: string; gender?: Gender; profileComplete?: boolean; status?: "active" | "inactive" | "deleted"; createdAt: string; lastLoginAt: string };
type AdminRepresentative = Profile & { _id: string; status: "draft" | "published" };
type AdminStats = { users: number; representatives: number; published: number; drafts: number };
type GoogleCredential = { credential: string };
type DirectoryFilters = { states: string[]; parties: string[] };
type SearchResponse = { data: Array<Record<string, unknown>>; pagination: { page: number; limit: number; total: number; totalPages: number } };

function normalizeRepresentative(record: Record<string, unknown>): Profile {
  const name = String(record.name ?? "");
  return {
    ...record, id: String(record._id ?? record.id ?? ""), name,
    initials: String(record.initials ?? name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)),
    party: String(record.party ?? ""), partyShort: String(record.partyShort ?? ""), office: record.office as Profile["office"],
    state: String(record.state ?? ""), constituency: String(record.constituency ?? ""), since: String(record.since ?? ""),
    education: String(record.education ?? ""), summary: String(record.summary ?? ""),
    sources: (record.sources ?? []) as Profile["sources"], elections: (record.elections ?? []) as Profile["elections"],
  } as Profile;
}
declare global { interface Window { google?: { accounts: { id: { initialize: (options: { client_id: string; callback: (response: GoogleCredential) => void }) => void; prompt: () => void } } } } }

function App() {
  const isAdminRoute = window.location.pathname.startsWith("/admin");
  const isDashboardRoute = window.location.pathname === "/dashboard";
  const isPoliticianRoute = window.location.pathname === "/politician" || window.location.pathname === "/politician/";
  const representativeMatch = window.location.pathname.match(/^\/representatives\/([^/]+)\/?$/);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileTotal, setProfileTotal] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { return localStorage.getItem("janpratinidhi-theme") === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  });
  const [user, setUser] = useState<User | null>(() => { try { const saved = sessionStorage.getItem("janpratinidhi-user"); return saved ? JSON.parse(saved) as User : null; } catch { return null; } });
  const [pendingProfile, setPendingProfile] = useState<User | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(() => Boolean(sessionStorage.getItem("janpratinidhi-admin-token")));
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminRepresentatives, setAdminRepresentatives] = useState<AdminRepresentative[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats>({ users: 0, representatives: 0, published: 0, drafts: 0 });
  const [adminLoading, setAdminLoading] = useState(false);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#141715" : "#f6f5f1");
    try { localStorage.setItem("janpratinidhi-theme", theme); } catch { /* Theme still works for this session. */ }
  }, [theme]);
  const toggleTheme = () => setTheme((current) => current === "dark" ? "light" : "dark");

  useEffect(() => {
    let active = true;
    if (isAdminRoute || isPoliticianRoute) return () => { active = false; };
    fetch(`${API_URL}/representatives?page=1&limit=8`).then((response) => response.ok ? response.json() : Promise.reject()).then((body: { data: Array<Record<string, unknown>>; pagination?: { total: number } }) => {
      if (!active) return;
      const records = body.data.map(normalizeRepresentative);
      setProfiles(records);
      setProfileTotal(body.pagination?.total ?? records.length);
    }).catch(() => { if (active) setProfiles([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    const credential = sessionStorage.getItem("janpratinidhi-google-token");
    if (!credential) { sessionStorage.removeItem("janpratinidhi-user"); setUser(null); return; }
    let active = true;
    const verifySession = () => fetch(`${API_URL}/auth/user/session`, { headers: { Authorization: `Bearer ${credential}` } }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Your session expired");
      if (active) { setUser(body.user); sessionStorage.setItem("janpratinidhi-user", JSON.stringify(body.user)); }
    }).catch(() => {
      if (active) { sessionStorage.removeItem("janpratinidhi-user"); sessionStorage.removeItem("janpratinidhi-google-token"); setUser(null); }
    });
    void verifySession();
    const timer = window.setInterval(() => { void verifySession(); }, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user?.id]);

  const signIn = async () => {
    if (!GOOGLE_CLIENT_ID) { setNotice("Google sign-in needs VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID configuration."); return; }
    setAuthBusy(true);
    try {
      const google = window.google;
      if (!google) throw new Error("Google sign-in is still loading. Please try again.");
      google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: async ({ credential }) => {
        try {
          const response = await fetch(`${API_URL}/auth/google`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error ?? "Google sign-in failed");
          if (!body.user.profileComplete) { sessionStorage.setItem("janpratinidhi-pending-google-token", credential); setPendingProfile(body.user); }
          else { setUser(body.user); sessionStorage.setItem("janpratinidhi-user", JSON.stringify(body.user)); sessionStorage.setItem("janpratinidhi-google-token", credential); setNotice(`Signed in as ${body.user.name}`); }
        } catch (error) { setNotice(error instanceof Error ? error.message : "Google sign-in failed"); }
        finally { setAuthBusy(false); }
      } });
      google.accounts.id.prompt();
    } catch (error) { setAuthBusy(false); setNotice(error instanceof Error ? error.message : "Google sign-in failed"); }
  };
  const signOut = () => { sessionStorage.removeItem("janpratinidhi-user"); sessionStorage.removeItem("janpratinidhi-google-token"); setUser(null); setNotice("You have been signed out"); };

  const completeUserProfile = async (profile: { firstName: string; lastName: string; phoneNumber: string; gender: Gender }) => {
    const credential = sessionStorage.getItem("janpratinidhi-pending-google-token");
    if (!credential) throw new Error("Google sign-in expired. Sign in again to finish your profile.");
    setProfileBusy(true);
    try {
      const response = await fetch(`${API_URL}/auth/complete-profile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...profile, credential }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save your profile");
      setUser(body.user); sessionStorage.setItem("janpratinidhi-user", JSON.stringify(body.user)); sessionStorage.setItem("janpratinidhi-google-token", credential); sessionStorage.removeItem("janpratinidhi-pending-google-token"); setPendingProfile(null); setNotice(`Welcome, ${body.user.firstName}`);
    } catch (error) { throw error; }
    finally { setProfileBusy(false); }
  };

  const openAdmin = async () => {
    setAdminOpen(true); setAdminLoading(true);
    try {
      const token = sessionStorage.getItem("janpratinidhi-admin-token");
      if (!token) { setAdminAuthenticated(false); setAdminOpen(false); throw new Error("Sign in with the admin email and password to continue."); }
      const headers = { Authorization: `Bearer ${token}` };
      const [usersResponse, repsResponse, statsResponse] = await Promise.all([
        fetch(`${API_URL}/admin/users`, { headers }), fetch(`${API_URL}/admin/representatives`, { headers }), fetch(`${API_URL}/admin/dashboard`, { headers }),
      ]);
      const [usersBody, repsBody, statsBody] = await Promise.all([usersResponse.json(), repsResponse.json(), statsResponse.json()]);
      const failed = [usersResponse, repsResponse, statsResponse].find((response) => !response.ok);
      if (failed) {
        if (failed.status === 401) { sessionStorage.removeItem("janpratinidhi-admin-token"); setAdminAuthenticated(false); setAdminOpen(false); }
        throw new Error([usersBody, repsBody, statsBody][[usersResponse, repsResponse, statsResponse].indexOf(failed)]?.error ?? "Could not load admin dashboard");
      }
      setAdminUsers(usersBody.data); setAdminRepresentatives(repsBody.data); setAdminStats(statsBody.stats);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not load admin dashboard"); }
    finally { setAdminLoading(false); }
  };

  useEffect(() => {
    if (isAdminRoute && adminAuthenticated) void openAdmin();
  }, []);

  const signInAdmin = async (email: string, password: string) => {
    setAdminBusy(true);
    try {
      const response = await fetch(`${API_URL}/auth/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Admin sign-in failed");
      sessionStorage.setItem("janpratinidhi-admin-token", body.token);
      setAdminAuthenticated(true); setNotice("Admin sign-in successful");
      await openAdmin();
    } catch (error) { throw error; }
    finally { setAdminBusy(false); }
  };

  const adminSignOut = () => {
    sessionStorage.removeItem("janpratinidhi-admin-token"); setAdminAuthenticated(false); setAdminOpen(false); setAdminUsers([]); setAdminRepresentatives([]); setNotice("Admin signed out");
  };

  const setAccountStatus = async (account: AdminUser, status: "active" | "inactive") => {
    try { await adminRequest(`/users/${account._id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); await openAdmin(); setNotice(`User ${status === "active" ? "activated" : "deactivated"}`); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not update user"); }
  };
  const deleteAccount = async (account: AdminUser) => {
    if (!window.confirm(`Delete ${account.name}'s account? They will not be able to sign in again.`)) return;
    try { await adminRequest(`/users/${account._id}`, { method: "DELETE" }); await openAdmin(); setNotice("User account deleted"); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not delete user"); }
  };

  const toggleSave = (id: string) => {
    setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setNotice(saved.includes(id) ? "Removed from your saved list" : "Saved for later");
    window.setTimeout(() => setNotice(""), 2200);
  };

  if (isAdminRoute) return <div className="admin-route-shell"><header className="admin-route-header"><a className="brand" href="/" aria-label="Janpratinidhi home"><span className="brand-mark"><Landmark size={19} /></span><span className="brand-name">janpratinidhi<span>.</span> <small>ADMIN</small></span></a><div className="theme-header-actions"><ThemeToggle theme={theme} onToggle={toggleTheme} /><a className="admin-return-link" href="/">View public website <ArrowUpRight size={14} /></a></div></header>{adminAuthenticated ? adminOpen ? <AdminPanel users={adminUsers} stats={adminStats} representatives={adminRepresentatives} loading={adminLoading} onRefresh={openAdmin} onNotice={setNotice} onClose={() => window.location.assign("/")} onSignOut={adminSignOut} onStatusChange={setAccountStatus} onDeleteUser={deleteAccount} /> : <div className="admin-route-loading">Loading admin dashboard…</div> : <div className="admin-route-login"><div className="admin-route-intro"><span className="admin-login-icon"><ShieldCheck size={23} /></span><div className="eyebrow small-eyebrow">JANPRATINIDHI ADMIN</div><h1>Manage your public directory.</h1><p>Sign in with your administrator credentials to manage representative records and review user accounts.</p><a href="/" className="admin-return-link">← Return to public website</a></div><AdminLoginForm busy={adminBusy} onSubmit={signInAdmin} /></div>}{notice && <div className="toast"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}</div>;
  if (isPoliticianRoute) return <PublicPoliticianPage theme={theme} onToggleTheme={toggleTheme} />;
  if (representativeMatch) return <RepresentativeDetailsPage identifier={decodeURIComponent(representativeMatch[1])} theme={theme} onToggleTheme={toggleTheme} />;
  if (isDashboardRoute) return user ? <UserDashboardPage user={user} onSignOut={signOut} theme={theme} onToggleTheme={toggleTheme} /> : <DashboardLoginGate theme={theme} onToggleTheme={toggleTheme} />;

  return <div className="site-shell">
     <header className="header">
      <a className="brand" href="#home" aria-label="Janpratinidhi home"><span className="brand-mark"><Landmark size={20} strokeWidth={2.2} /></span><span className="brand-name">Jan Pratinidhi<span>.</span></span></a>
      <button className="mobile-menu icon-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation">{mobileNav ? <X /> : <Menu />}</button>
      <nav className={mobileNav ? "nav-links open" : "nav-links"}>
        <a className="active" href="/politician">Explore people</a><a href="#how">How it works</a><a href="#about">About the project</a>
      </nav>
      {/* <a className="login-button admin-header-button" href="/admin/dashboard">Admin <Landmark size={14} /></a> */}
      {user && <a className="login-button dashboard-header-button" href="/dashboard">Dashboard <ArrowRight size={14} /></a>}
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      {user ? <button className="login-button user-button" onClick={signOut} title={`Signed in as ${user.email}`}>{user.picture && <img src={user.picture} alt="" />}<span>{user.name.split(" ")[0]}</span><LogOut size={14} /></button> : <button className="login-button" onClick={signIn} disabled={authBusy}>{authBusy ? "Signing in…" : "Sign In"} <ArrowRight size={15} /></button>}
    </header>

    <main>
      <section className="hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-icon"><Sparkles size={13} /></span> YOUR PUBLIC REPRESENTATIVE DIRECTORY</div>
          <h1>Know the people<br />who <em>represent you.</em></h1>
          <p className="hero-sub">A clearer view of India's elected representatives, their public records, and the sources behind every detail.</p>
          <div className="hero-actions"><a href="/politician" className="primary-button">Explore politicians <ArrowRight size={16} /></a><a href="#how" className="text-button">How we source data <ArrowDownRight size={15} /></a></div>
          <div className="hero-proof"><div className="proof-avatars"><span>IN</span><span>EC</span><span>OP</span></div><span>Built on public records.<br /><b>Open for everyone.</b></span></div>
        </div>
        <div className="hero-art" aria-label="Illustration of the Indian Parliament">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="art-caption"><span className="caption-line" /> PEOPLE'S HOUSE <span>·</span> NEW DELHI</div>
          <div className="parliament-card">
            <div className="building-sun" /><div className="building-ground" />
            <div className="building-roof"><span /><span /><span /><span /><span /><span /><span /></div>
            <div className="building-top" />
            <div className="building-columns">{Array.from({ length: 11 }).map((_, i) => <i key={i} />)}</div>
            <div className="building-base" /><div className="building-steps" />
            <span className="flag flag-one" /><span className="flag flag-two" />
          </div>
          <div className="floating-note note-source"><span className="note-icon"><FileText size={15} /></span><span><b>Every fact has a source</b><small>Read the original record ↗</small></span></div>
          <div className="floating-note note-record"><span className="note-check"><Check size={15} /></span><span><b>Verified public records</b><small>With dates and context</small></span></div>
          <div className="art-footnote">A public resource, shaped by the public <span>✳</span></div>
        </div>
      </section>

      <section className="stats-band" aria-label="Directory overview">
        <div className="stat"><span className="stat-icon orange"><Landmark size={17} /></span><span><b>{profileTotal.toLocaleString("en-IN")}</b><small>Published profiles</small></span></div>
        <div className="stat"><span className="stat-icon blue"><Vote size={17} /></span><span><b>3</b><small>Types of office</small></span></div>
        <div className="stat"><span className="stat-icon green"><ShieldCheck size={17} /></span><span><b>Source first</b><small>Every record traceable</small></span></div>
        <div className="stats-note">Published public records<span> · </span>National coverage is in progress</div>
      </section>

      <section className="directory-section" id="directory">
        <div className="section-heading"><div><div className="eyebrow small-eyebrow">THE DIRECTORY <span className="heading-rule" /></div><h2>Meet your representatives<span>.</span></h2><p>Browse MPs and MLAs by name, constituency, state, or party. Each profile links to its available public sources.</p></div></div>
        <div className="people-grid">
          {profiles.map((person, index) => <PersonCard key={person.id} person={person} index={index} saved={saved.includes(person.id)} onOpen={() => setSelected(person)} onSave={() => toggleSave(person.id)} />)}
        </div>
        <div className="directory-bottom"><span>Explore {profileTotal.toLocaleString("en-IN")} published MP and MLA profiles.</span><a className="primary-button" href="/politician">Explore politician <ArrowRight size={15} /></a></div>
      </section>

      <section className="trust-section" id="how"><div className="trust-copy"><div className="eyebrow small-eyebrow">BUILT FOR TRUST <span className="heading-rule" /></div><h2>Facts you can<br /><em>follow through.</em></h2><p>Public information should be easy to find and simple to verify. We connect each profile to the original public record, so you can check the context for yourself.</p><a href="https://www.eci.gov.in/affidavit-portal" target="_blank" rel="noreferrer" className="source-link">Explore ECI affidavit portal <ExternalLink size={14} /></a></div>
        <div className="trust-steps"><TrustStep number="01" icon={<Search size={18} />} title="Find a person" body="Search by name, state, constituency, party, or office." /><TrustStep number="02" icon={<FileText size={18} />} title="Check the record" body="See public education details, terms, and election results." /><TrustStep number="03" icon={<ExternalLink size={18} />} title="Go to the source" body="Open the original portal or document behind a claim." /></div>
      </section>
      <section className="bottom-cta" id="about"><span className="cta-mark"><Landmark size={20} /></span><div><h3>Democracy works better when it's easier to understand.</h3><p>Help make public information clearer, one well-sourced record at a time.</p></div><button onClick={() => setNotice("Thanks for your interest. The contributor guide will be available soon.")}>Get involved <ArrowRight size={15} /></button><div className="cta-deco">✳</div></section>
    </main>
    <footer><a className="brand footer-brand" href="#home"><span className="brand-mark"><Landmark size={17} /></span><span className="brand-name">janpratinidhi<span>.</span></span></a><span>Independent. Open source. Made for citizens.</span><div><a href="#how">Sources & methodology</a><a href="#about">Contribute</a><a href="https://github.com/" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a></div><small>© 2026 Janpratinidhi community</small></footer>

    {notice && <div className="toast"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
    {selected && <ProfileModal person={selected} onClose={() => setSelected(null)} onSave={() => toggleSave(selected.id)} saved={saved.includes(selected.id)} />}
    {pendingProfile && <ProfileCompletionModal user={pendingProfile} busy={profileBusy} onSubmit={completeUserProfile} />}
  </div>;
}

function ThemeToggle({ theme, onToggle }: { theme: "light" | "dark"; onToggle: () => void }) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  return <button className="theme-toggle" type="button" onClick={onToggle} aria-label={`Switch to ${nextTheme} mode`} aria-pressed={theme === "dark"} title={`Switch to ${nextTheme} mode`}>
    {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
  </button>;
}

function PublicPoliticianPage({ theme, onToggleTheme }: { theme: "light" | "dark"; onToggleTheme: () => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [state, setState] = useState("");
  const [party, setParty] = useState("");
  const [filters, setFilters] = useState<DirectoryFilters>({ states: [], parties: [] });
  const [records, setRecords] = useState<Profile[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/representatives/directory-filters`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load directory filters");
      if (active) setFilters(body);
    }).catch(() => { if (active) setFilters({ states: [], parties: [] }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: "50", type });
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (state) params.set("state", state);
    if (party) params.set("party", party);
    setLoading(true); setError("");
    fetch(`${API_URL}/representatives?${params}`, { signal: controller.signal }).then(async (response) => {
      const body = await response.json() as SearchResponse & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not load politicians");
      setRecords(body.data.map(normalizeRepresentative));
      setTotal(body.pagination.total); setTotalPages(body.pagination.totalPages);
    }).catch((reason) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Could not load politicians");
      setRecords([]); setTotal(0); setTotalPages(0);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [debouncedQuery, type, state, party, page, reload]);

  const resetPage = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(""); setDebouncedQuery(""); setType("ALL"); setState(""); setParty(""); setPage(1); };

  return <div className="dashboard-shell public-politician-shell">
    <header className="dashboard-topbar"><a className="brand" href="/"><span className="brand-mark"><Landmark size={19} /></span><span className="brand-name">janpratinidhi<span>.</span></span></a><div className="theme-header-actions"><ThemeToggle theme={theme} onToggle={onToggleTheme} /><a className="dashboard-back-link" href="/">← Home</a></div></header>
    <main className="dashboard-main">
      <div className="dashboard-breadcrumb"><a href="/">Home</a><span>/</span><b>Explore politicians</b></div>
      <div className="dashboard-title"><div><div className="eyebrow small-eyebrow">PUBLIC DIRECTORY <span className="heading-rule" /></div><h1>Explore politicians</h1><p>Search MPs and MLAs by name, constituency, state, or party.</p></div><span className="dashboard-total">{total.toLocaleString("en-IN")} records</span></div>
      <form className="representative-search-form" onSubmit={(event) => { event.preventDefault(); setDebouncedQuery(query.trim()); setPage(1); }}>
        <div className="dashboard-search-box"><Search size={19} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, constituency, state or party" aria-label="Search politicians" /><button type="submit" aria-label="Search politicians"><Search size={17} /><span>Search</span></button></div>
        <div className="dashboard-filters"><label>Type<select value={type} onChange={(event) => resetPage(setType)(event.target.value)}><option value="ALL">All</option><option value="MP">MP</option><option value="MLA">MLA</option></select></label><label>State<select value={state} onChange={(event) => resetPage(setState)(event.target.value)}><option value="">All states</option>{filters.states.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Party<select value={party} onChange={(event) => resetPage(setParty)(event.target.value)}><option value="">All parties</option>{filters.parties.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
      </form>
      <div className="results-heading"><div><h2>Politician profiles</h2><p>Showing {records.length ? `${(page - 1) * 50 + 1}–${(page - 1) * 50 + records.length} of ${total.toLocaleString("en-IN")}` : "0"} records</p></div><span>Page {totalPages ? page : 0} of {totalPages}</span></div>
      {loading ? <div className="directory-state" role="status"><span className="loading-spinner" />Loading politician records…</div> : error ? <div className="directory-state error-state" role="alert"><h3>We couldn’t load the directory</h3><p>{error}</p><button onClick={() => setReload((value) => value + 1)}>Try again</button></div> : records.length === 0 ? <div className="directory-state empty-results"><Search size={26} /><h3>No matching politicians</h3><p>Try another search or remove a filter.</p><button onClick={clearFilters}>Clear search and filters</button></div> : <div className="representative-results-grid">{records.map((person) => <RepresentativeSearchCard key={person.id} person={person} />)}</div>}
      {!loading && !error && totalPages > 1 && <nav className="pagination-controls" aria-label="Politician directory pages"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button><span>Page {page} of {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next →</button></nav>}
    </main>
  </div>;
}

function DashboardLoginGate({ theme, onToggleTheme }: { theme: "light" | "dark"; onToggleTheme: () => void }) {
  return <div className="dashboard-login-gate"><div className="login-gate-header"><a className="brand" href="/"><span className="brand-mark"><Landmark size={19} /></span><span className="brand-name">janpratinidhi<span>.</span></span></a><ThemeToggle theme={theme} onToggle={onToggleTheme} /></div><div><ShieldCheck size={30} /><h1>Sign in to your dashboard</h1><p>Use your Google account to search the representative directory.</p><a className="primary-button" href="/">Go to sign in <ArrowRight size={15} /></a></div></div>;
}

function UserDashboardPage({ user, onSignOut, theme, onToggleTheme }: { user: User; onSignOut: () => void; theme: "light" | "dark"; onToggleTheme: () => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [state, setState] = useState("");
  const [party, setParty] = useState("");
  const [filters, setFilters] = useState<DirectoryFilters>({ states: [], parties: [] });
  const [records, setRecords] = useState<Profile[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 320);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    const credential = sessionStorage.getItem("janpratinidhi-google-token") ?? "";
    fetch(`${API_URL}/representatives/filters`, { headers: { Authorization: `Bearer ${credential}` } }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load search filters");
      if (active) setFilters(body);
    }).catch(() => { if (active) setFilters({ states: [], parties: [] }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: "10", type });
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (state) params.set("state", state);
    if (party) params.set("party", party);
    setLoading(true); setError("");
    const credential = sessionStorage.getItem("janpratinidhi-google-token") ?? "";
    fetch(`${API_URL}/representatives/search?${params}`, { signal: controller.signal, headers: { Authorization: `Bearer ${credential}` } }).then(async (response) => {
      const body = await response.json() as SearchResponse & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not search representatives");
      setRecords(body.data.map(normalizeRepresentative)); setTotal(body.pagination.total); setTotalPages(body.pagination.totalPages);
    }).catch((reason) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Could not search representatives"); setRecords([]); setTotal(0); setTotalPages(0);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [debouncedQuery, type, state, party, page, reload]);

  const resetPage = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };
  return <div className="dashboard-shell"><header className="dashboard-topbar"><a className="brand" href="/"><span className="brand-mark"><Landmark size={19} /></span><span className="brand-name">janpratinidhi<span>.</span></span></a><div className="dashboard-header-actions"><ThemeToggle theme={theme} onToggle={onToggleTheme} /><div className="dashboard-user"><span className="dashboard-user-name">{user.firstName ?? user.name}</span>{user.picture && <img src={user.picture} alt="" />}<button onClick={onSignOut}>Sign out</button></div></div></header>
    <main className="dashboard-main"><div className="dashboard-breadcrumb"><a href="/">Home</a><span>/</span><b>Dashboard</b></div><div className="dashboard-title"><div><div className="eyebrow small-eyebrow">YOUR DASHBOARD <span className="heading-rule" /></div><h1>Find Your MP / MLA</h1><p>Search published, source-linked representative records by name, place, or party.</p></div><span className="dashboard-total">{total.toLocaleString("en-IN")} {total === 1 ? "record" : "records"}</span></div>
      <form className="representative-search-form" onSubmit={(event) => { event.preventDefault(); setDebouncedQuery(query.trim()); setPage(1); }}><div className="dashboard-search-box"><Search size={19} aria-hidden="true" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by name, constituency, state or party" aria-label="Search representatives by name, constituency, state or party" /><button type="submit" aria-label="Search representatives"><Search size={17} /><span>Search</span></button></div><div className="dashboard-filters"><label>Type<select value={type} onChange={(event) => resetPage(setType)(event.target.value)}><option value="ALL">All</option><option value="MP">MP</option><option value="MLA">MLA</option></select></label><label>State<select value={state} onChange={(event) => resetPage(setState)(event.target.value)}><option value="">All states</option>{filters.states.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Party<select value={party} onChange={(event) => resetPage(setParty)(event.target.value)}><option value="">All parties</option>{filters.parties.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div></form>
      <div className="results-heading"><div><h2>Representatives</h2><p>Showing up to 10 verified database records per page.</p></div><span>Page {totalPages ? page : 0} of {totalPages}</span></div>
      {loading ? <div className="directory-state" role="status"><span className="loading-spinner" />Searching the public records…</div> : error ? <div className="directory-state error-state" role="alert"><h3>We couldn’t load the directory</h3><p>{error}</p><button onClick={() => setReload((n) => n + 1)}>Try again</button></div> : records.length === 0 ? <div className="directory-state empty-results"><Search size={26} /><h3>No matching published records</h3><p>Try a different name or clear one of the filters. Only approved records from the database appear here.</p><button onClick={() => { setQuery(""); setDebouncedQuery(""); setType("ALL"); setState(""); setParty(""); setPage(1); }}>Clear search and filters</button></div> : <div className="representative-results-grid">{records.map((person) => <RepresentativeSearchCard key={person.id} person={person} />)}</div>}
      {!loading && !error && totalPages > 1 && <nav className="pagination-controls" aria-label="Representative results pages"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button><span>Page {page} of {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next →</button></nav>}
    </main>
  </div>;
}

function RepresentativeSearchCard({ person }: { person: Profile }) {
  const designation = person.office.includes("MP") ? "MP" : "MLA";
  const house = person.house || (person.office === "Lok Sabha MP" ? "Lok Sabha" : person.office === "Rajya Sabha MP" ? "Rajya Sabha" : person.office === "MLA" ? "Vidhan Sabha" : "");
  return <article className="representative-result-card"><div className="result-card-top"><RepresentativePhoto url={person.photoUrl} initials={person.initials} name={person.name} /><div className="result-party-symbol"><PartySymbol url={person.partySymbolUrl} party={person.party} shortName={person.partyShort} /></div></div><div className="result-office-tag">{designation}<span>·</span>{person.office}</div><h3>{person.name}</h3><p className="result-party-name">{person.party}</p><dl className="result-card-facts"><div><dt>Constituency</dt><dd>{person.constituency || "Not listed"}</dd></div><div><dt>State</dt><dd>{person.state}</dd></div>{house && <div><dt>House</dt><dd>{house}</dd></div>}</dl><a className="result-view-more" href={`/representatives/${encodeURIComponent(person.slug || person.id)}`}>View more <ArrowRight size={15} /></a></article>;
}

function PartySymbol({ url, party, shortName }: { url?: string; party: string; shortName: string }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? <img src={url} alt={`${party} symbol`} onError={() => setFailed(true)} /> : <span aria-label={`No symbol image available for ${party}`}>{shortName || party.slice(0, 3) || "—"}</span>;
}

function RepresentativePhoto({ url, initials, name }: { url?: string; initials: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? <img className="representative-photo" src={url} alt={`${name} portrait`} loading="lazy" onError={() => setFailed(true)} /> : <span className="representative-photo photo-fallback" role="img" aria-label={`No photo available for ${name}`}>{initials || "—"}</span>;
}

function RepresentativeAvatar({ person, tone = "tone-peach", showSpark = false }: { person: Profile; tone?: string; showSpark?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <span className={`avatar ${tone}`} role="img" aria-label={`${person.name} portrait`}>
    {person.photoUrl && !failed ? <img src={person.photoUrl} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} onError={() => setFailed(true)} /> : <span>{person.initials || "—"}</span>}
    {showSpark && <i className="avatar-spark" aria-hidden="true">✳</i>}
  </span>;
}

function RepresentativeDetailsPage({ identifier, theme, onToggleTheme }: { identifier: string; theme: "light" | "dark"; onToggleTheme: () => void }) {
  const [person, setPerson] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/representatives/${encodeURIComponent(identifier)}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Representative not found");
      if (active) setPerson(normalizeRepresentative(body.data));
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load this record"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [identifier]);
  const house = person?.house || (person?.office === "Lok Sabha MP" ? "Lok Sabha" : person?.office === "Rajya Sabha MP" ? "Rajya Sabha" : person?.office === "MLA" ? "Vidhan Sabha" : "");
  return <div className="dashboard-shell profile-route-shell"><header className="dashboard-topbar"><a className="brand" href="/"><span className="brand-mark"><Landmark size={19} /></span><span className="brand-name">janpratinidhi<span>.</span></span></a><div className="theme-header-actions"><ThemeToggle theme={theme} onToggle={onToggleTheme} /><a className="dashboard-back-link" href="/politician">← Back to politicians</a></div></header><main className="representative-detail-main">{loading ? <div className="directory-state" role="status"><span className="loading-spinner" />Loading representative record…</div> : error || !person ? <div className="directory-state error-state" role="alert"><h1>Record unavailable</h1><p>{error || "This representative is not in the published directory."}</p><a href="/politician" className="primary-button">Return to politicians <ArrowRight size={15} /></a></div> : <><a className="dashboard-back-link detail-back" href="/politician">← Back to politicians</a><section className="representative-profile-hero"><RepresentativePhoto url={person.photoUrl} initials={person.initials} name={person.name} /><div className="detail-identity"><span className="result-office-tag">{person.office}</span><h1>{person.name}</h1><p>{person.party}</p><div className="detail-symbol"><PartySymbol url={person.partySymbolUrl} party={person.party} shortName={person.partyShort} /></div></div></section><div className="representative-detail-grid"><section className="representative-detail-card"><h2>Representative details</h2><dl className="detail-facts">{person.state && <div><dt>State</dt><dd>{person.state}</dd></div>}{person.constituency && <div><dt>Constituency</dt><dd>{person.constituency}</dd></div>}{house && <div><dt>House</dt><dd>{house}</dd></div>}{(person.termStart || person.termEnd || person.since) && <div><dt>Term</dt><dd>{person.termStart || person.since || ""}{person.termEnd ? ` – ${person.termEnd}` : person.termStart || person.since ? " – Present" : ""}</dd></div>}{person.electionYear && <div><dt>Election year</dt><dd>{person.electionYear}</dd></div>}{person.education && <div><dt>Education</dt><dd>{person.education}</dd></div>}</dl>{(person.description || person.summary) && <div className="profile-description"><h3>Biography</h3><p>{person.description || person.summary}</p></div>}</section><div className="representative-record-column">{person.elections.length > 0 && <section className="representative-detail-card"><h2>Election information</h2>{person.elections.map((election, index) => <article className="detail-election-row" key={`${election.year}-${index}`}><div><b>{election.year} · {election.electionType}</b><p>{election.constituency}, {election.state}</p><small>{election.party} · {election.result} · {election.votes.toLocaleString("en-IN")} votes{election.margin ? ` · margin ${election.margin.toLocaleString("en-IN")}` : ""}</small></div>{election.source?.url && <a href={election.source.url} target="_blank" rel="noreferrer" aria-label={`Open source for ${election.year} election`}><ExternalLink size={15} /></a>}</article>)}</section>}{person.sources.length > 0 && <section className="representative-detail-card"><h2>Verified sources</h2>{person.sources.map((source, index) => <a className="detail-source-link" key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer"><FileText size={16} /><span><b>{source.title}</b><small>{source.publisher}{source.accessedAt ? ` · checked ${source.accessedAt}` : ""}</small></span><ExternalLink size={14} /></a>)}</section>}{person.recordData && Object.keys(person.recordData).length > 0 && <section className="representative-detail-card"><h2>Additional public records</h2><dl className="detail-facts">{Object.entries(person.recordData).map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1")}</dt><dd>{typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}</dd></div>)}</dl></section>}</div></div></>}</main></div>;
}

function ProfileCompletionModal({ user, busy, onSubmit }: { user: User; busy: boolean; onSubmit: (profile: { firstName: string; lastName: string; phoneNumber: string; gender: Gender }) => Promise<void> }) {
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const values = new FormData(event.currentTarget);
    try { await onSubmit({ firstName: String(values.get("firstName") ?? ""), lastName: String(values.get("lastName") ?? ""), phoneNumber: String(values.get("phoneNumber") ?? ""), gender: String(values.get("gender") ?? "") as Gender }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your profile"); }
  };
  return <div className="modal-backdrop profile-completion-backdrop"><section className="profile-modal profile-completion-modal" role="dialog" aria-modal="true" aria-labelledby="complete-profile-title"><div className="admin-login-icon"><Landmark size={21} /></div><div className="eyebrow small-eyebrow">ONE MORE STEP</div><h2 id="complete-profile-title">Complete your profile</h2><p className="profile-completion-copy">Signed in with {user.email}. Add these details to finish creating your account.</p><form className="profile-completion-form" onSubmit={submit}><label>First name<input name="firstName" autoComplete="given-name" defaultValue={user.firstName} maxLength={80} required /></label><label>Last name<input name="lastName" autoComplete="family-name" defaultValue={user.lastName} maxLength={80} required /></label><label>Phone number<input name="phoneNumber" type="tel" autoComplete="tel" placeholder="+91 98765 43210" defaultValue={user.phoneNumber} required /></label><label>Gender<select name="gender" defaultValue={user.gender ?? ""} required><option value="" disabled>Select an option</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></label><p className="profile-data-note">Your details are used for your account and shown to administrators.</p>{error && <p className="admin-login-error">{error}</p>}<button className="admin-add-button" type="submit" disabled={busy}>{busy ? "Saving profile…" : "Save and continue"}</button></form></section></div>;
}

function AdminLoginForm({ busy, onSubmit }: { busy: boolean; onSubmit: (email: string, password: string) => Promise<void> }) {
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const values = new FormData(event.currentTarget);
    try { await onSubmit(String(values.get("email") ?? ""), String(values.get("password") ?? "")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Admin sign-in failed"); }
  };
  return <form className="admin-route-login-form" onSubmit={submit}><h2>Admin sign in</h2><p>Enter the administrator email and password.</p><label>Admin email<input type="email" name="email" autoComplete="username" required autoFocus /></label><label>Password<input type="password" name="password" autoComplete="current-password" required /></label>{error && <p className="admin-login-error">{error}</p>}<button className="admin-add-button" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to admin"}</button></form>;
}

async function adminRequest(path: string, init: RequestInit = {}) {
  const token = sessionStorage.getItem("janpratinidhi-admin-token");
  if (!token) throw new Error("Your admin session expired. Sign in again.");
  const response = await fetch(`${API_URL}/admin${path}`, { ...init, headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}`, ...init.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Admin request failed");
  return body;
}

function AdminPanel({ users, stats, representatives: records, loading, onRefresh, onNotice, onClose, onSignOut, onStatusChange, onDeleteUser }: { users: AdminUser[]; stats: AdminStats; representatives: AdminRepresentative[]; loading: boolean; onRefresh: () => Promise<void>; onNotice: (message: string) => void; onClose: () => void; onSignOut: () => void; onStatusChange: (user: AdminUser, status: "active" | "inactive") => void; onDeleteUser: (user: AdminUser) => void }) {
  const [view, setView] = useState<"overview" | "representatives" | "users">("overview");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<AdminRepresentative | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const visibleRecords = records.filter((person) => `${person.name} ${person.party} ${person.state} ${person.constituency}`.toLowerCase().includes(search.toLowerCase()));

  const saveRepresentative = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parseJsonList = (key: string) => {
      const value = String(form.get(key) ?? "[]").trim();
      const parsed = JSON.parse(value || "[]");
      if (!Array.isArray(parsed)) throw new Error(`${key} must be a JSON array`);
      return parsed;
    };
    try {
      setSaving(true);
      const name = String(form.get("name") ?? "").trim();
      const payload = {
        name, slug: String(form.get("slug") ?? "").trim(), initials: String(form.get("initials") ?? "").trim() || name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
        party: String(form.get("party") ?? "").trim(), partyShort: String(form.get("partyShort") ?? "").trim(), office: String(form.get("office") ?? ""),
        state: String(form.get("state") ?? "").trim(), constituency: String(form.get("constituency") ?? "").trim(), since: String(form.get("since") ?? "").trim(),
        photoUrl: String(form.get("photoUrl") ?? "").trim(), partySymbolUrl: String(form.get("partySymbolUrl") ?? "").trim(), house: String(form.get("house") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(), termStart: String(form.get("termStart") ?? "").trim(), termEnd: String(form.get("termEnd") ?? "").trim(),
        electionYear: form.get("electionYear") ? Number(form.get("electionYear")) : undefined,
        education: String(form.get("education") ?? "").trim(), summary: String(form.get("summary") ?? "").trim(), status: String(form.get("status") ?? "draft"),
        sources: parseJsonList("sources"), elections: parseJsonList("elections"), recordData: JSON.parse(String(form.get("recordData") ?? "{}") || "{}"),
      };
      if (!payload.partyShort) payload.partyShort = payload.party.slice(0, 3).toUpperCase();
      const path = editor === "new" ? "/representatives" : `/representatives/${editor?._id}`;
      await adminRequest(path, { method: editor === "new" ? "POST" : "PATCH", body: JSON.stringify(payload) });
      setEditor(null); await onRefresh(); onNotice("Representative record saved");
    } catch (error) { onNotice(error instanceof Error ? error.message : "Could not save record"); }
    finally { setSaving(false); }
  };

  const removeRepresentative = async (person: AdminRepresentative) => {
    if (!window.confirm(`Permanently delete ${person.name}'s record?`)) return;
    try { await adminRequest(`/representatives/${person._id}`, { method: "DELETE" }); await onRefresh(); onNotice("Representative record deleted"); }
    catch (error) { onNotice(error instanceof Error ? error.message : "Could not delete record"); }
  };

  return <section className="admin-panel" id="admin-panel">
    <div className="admin-panel-heading"><div><div className="eyebrow small-eyebrow">ADMINISTRATION <span className="heading-rule" /></div><h2>Website dashboard<span>.</span></h2><p>Manage representative records and review registered Google accounts.</p></div><div className="admin-heading-actions"><button className="modal-done" onClick={onClose}>Close admin</button><button className="modal-done" onClick={onSignOut}>Sign out admin</button></div></div>
    <div className="admin-layout"><nav className="admin-sidebar" aria-label="Admin sections">{([["overview", "Overview"], ["representatives", "Representatives"], ["users", "Signed-in users"]] as const).map(([key, label]) => <button key={key} className={view === key ? "admin-side-button active" : "admin-side-button"} onClick={() => { setView(key); setEditor(null); }}>{label}{key === "users" && <span>{stats.users}</span>}</button>)}</nav>
      <div className="admin-content">{loading ? <p className="admin-empty">Loading dashboard data…</p> : <>
        {view === "overview" && <><div className="admin-stat-grid">{[["Registered users", stats.users], ["All representative records", stats.representatives], ["Published on website", stats.published], ["Drafts", stats.drafts]].map(([label, value]) => <article className="admin-stat-card" key={label}><small>{label}</small><b>{value}</b></article>)}</div><div className="admin-overview-row"><div><h3>Recent sign-ins</h3><p>Latest accounts registered with Google</p></div><button className="admin-inline-button" onClick={() => setView("users")}>View all users <ArrowRight size={14} /></button></div>{users.slice(0, 5).length ? <UserTable users={users.slice(0, 5)} onStatusChange={onStatusChange} onDeleteUser={onDeleteUser} /> : <p className="admin-empty">No users have signed in yet.</p>}<div className="admin-overview-row"><div><h3>Representative content</h3><p>{stats.published} published · {stats.drafts} drafts</p></div><button className="admin-inline-button" onClick={() => setView("representatives")}>Manage records <ArrowRight size={14} /></button></div></>}
        {view === "users" && <><div className="admin-view-title"><div><h3>Signed-in users</h3><p>{users.length} registered Google {users.length === 1 ? "account" : "accounts"}</p></div></div>{users.length ? <UserTable users={users} onStatusChange={onStatusChange} onDeleteUser={onDeleteUser} /> : <p className="admin-empty">No Google accounts have signed in yet.</p>}</>}
        {view === "representatives" && <><div className="admin-view-title"><div><h3>Representative records</h3><p>Only published records appear in the public directory.</p></div>{!editor && <button className="admin-add-button" onClick={() => setEditor("new")}>+ Add representative</button>}</div>{editor ? <RepresentativeEditor key={editor === "new" ? "new" : editor._id} person={editor === "new" ? undefined : editor} saving={saving} onCancel={() => setEditor(null)} onSubmit={saveRepresentative} /> : <><div className="admin-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records by person, party, state…" /></div>{visibleRecords.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Representative</th><th>Office</th><th>State / constituency</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleRecords.map((person) => <tr key={person._id}><td><b>{person.name}</b><small className="admin-subline">{person.party}</small></td><td>{person.office}</td><td>{person.state}<small className="admin-subline">{person.constituency || "Constituency not set"}</small></td><td><span className={`admin-status ${person.status}`}>{person.status}</span></td><td><div className="admin-row-actions"><button onClick={() => setEditor(person)}>Edit</button><button className="danger" onClick={() => void removeRepresentative(person)}>Delete</button></div></td></tr>)}</tbody></table></div> : <p className="admin-empty">No database records found. Add a representative to get started.</p>}</>}</>}
      </>}</div>
    </div>
  </section>;
}

function UserTable({ users, onStatusChange, onDeleteUser }: { users: AdminUser[]; onStatusChange: (user: AdminUser, status: "active" | "inactive") => void; onDeleteUser: (user: AdminUser) => void }) {
  const genderLabel: Record<Gender, string> = { female: "Female", male: "Male", non_binary: "Non-binary", prefer_not_to_say: "Not specified" };
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Email</th><th>Phone</th><th>Gender</th><th>Joined</th><th>Last sign-in</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map((account) => <tr key={account._id}><td><span className="admin-user-cell">{account.picture && <img src={account.picture} alt="" />}<b>{account.name}</b></span></td><td>{account.email}</td><td>{account.phoneNumber || "Profile incomplete"}</td><td>{account.gender ? genderLabel[account.gender] : "—"}</td><td>{new Date(account.createdAt).toLocaleDateString()}</td><td>{new Date(account.lastLoginAt).toLocaleString()}</td><td><span className={`admin-status ${account.status ?? "active"}`}>{account.status ?? "active"}</span></td><td><div className="admin-row-actions">{account.status !== "deleted" && <><button onClick={() => onStatusChange(account, account.status === "inactive" ? "active" : "inactive")}>{account.status === "inactive" ? "Activate" : "Deactivate"}</button><button className="danger" onClick={() => onDeleteUser(account)}>Delete</button></>}</div></td></tr>)}</tbody></table></div>;
}

function RepresentativeEditor({ person, saving, onCancel, onSubmit }: { person?: AdminRepresentative; saving: boolean; onCancel: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <form className="admin-editor" onSubmit={onSubmit}><div className="admin-editor-heading"><h3>{person ? `Edit ${person.name}` : "Add representative"}</h3><span>Required fields are marked *</span></div>
    <div className="admin-form-grid"><label>Full name *<input name="name" required defaultValue={person?.name} /></label><label>Slug<input name="slug" defaultValue={person?.slug} placeholder="optional-profile-url-name" /></label><label>Initials<input name="initials" maxLength={4} defaultValue={person?.initials} /></label>
      <label>Office *<select name="office" required defaultValue={person?.office ?? "MLA"}>{filters.slice(1).map((office) => <option key={office}>{office}</option>)}</select></label><label>Record status<select name="status" defaultValue={person?.status ?? "draft"}><option value="draft">Draft (hidden)</option><option value="published">Published (public)</option></select></label>
      <label>Party *<input name="party" required defaultValue={person?.party} /></label><label>Party short name<input name="partyShort" defaultValue={person?.partyShort} /></label><label>Party symbol image URL<input name="partySymbolUrl" type="url" defaultValue={person?.partySymbolUrl} /></label><label>Profile photo URL<input name="photoUrl" type="url" defaultValue={person?.photoUrl} /></label><label>State *<input name="state" required defaultValue={person?.state} /></label><label>Constituency<input name="constituency" defaultValue={person?.constituency} /></label><label>House<input name="house" placeholder="Lok Sabha or Vidhan Sabha" defaultValue={person?.house} /></label><label>Serving since<input name="since" defaultValue={person?.since} /></label><label>Term start<input name="termStart" defaultValue={person?.termStart} placeholder="YYYY or date" /></label><label>Term end<input name="termEnd" defaultValue={person?.termEnd} placeholder="YYYY or date" /></label><label>Election year<input name="electionYear" type="number" min="1900" max="2200" defaultValue={person?.electionYear} /></label><label>Education<input name="education" defaultValue={person?.education} /></label>
      <label className="wide-field">Biography / description<textarea name="description" rows={3} defaultValue={person?.description ?? person?.summary} /></label><label className="wide-field">Profile summary<textarea name="summary" rows={2} defaultValue={person?.summary} /></label>
      <label className="wide-field">Sources (JSON array)<textarea name="sources" rows={4} defaultValue={JSON.stringify(person?.sources ?? [], null, 2)} spellCheck={false} /><small>Each source needs title, url, publisher, sourceType, and accessedAt.</small></label>
      <label className="wide-field">Election history (JSON array)<textarea name="elections" rows={5} defaultValue={JSON.stringify(person?.elections ?? [], null, 2)} spellCheck={false} /><small>Keep each election's source details with its result.</small></label><label className="wide-field">Additional record data (JSON object)<textarea name="recordData" rows={5} defaultValue={JSON.stringify(person?.recordData ?? {}, null, 2)} spellCheck={false} /></label></div>
    <div className="admin-editor-actions"><button type="button" className="modal-done" onClick={onCancel}>Cancel</button><button type="submit" className="admin-add-button" disabled={saving}>{saving ? "Saving…" : "Save record"}</button></div>
  </form>;
}

function PersonCard({ person, index, saved, onOpen, onSave }: { person: Profile; index: number; saved: boolean; onOpen: () => void; onSave: () => void }) {
  const tones = ["tone-peach", "tone-sage", "tone-lavender", "tone-sky"];
  return <article className="person-card" style={{ animationDelay: `${index * 55}ms` }}>
    <div className="card-top"><span className="office-tag"><span className="tag-dot" />{person.office}</span><button className={saved ? "save-button is-saved" : "save-button"} onClick={onSave} title={saved ? "Remove saved profile" : "Save profile"}><Bookmark size={17} fill={saved ? "currentColor" : "none"} /></button></div>
    <button className="person-main" onClick={onOpen}><RepresentativeAvatar person={person} tone={tones[index % tones.length]} showSpark /><span className="person-name">{person.name}</span><span className="person-loc"><span>{person.constituency}</span><i>·</i><span>{person.state}</span></span></button>
    <div className="card-divider" /><div className="party-line"><span className="party-monogram">{person.partyShort.slice(0, 2)}</span><span>{person.party}</span><ArrowUpRight size={13} className="party-arrow" /></div>
    <div className="card-foot"><span><span className="verified-dot"><Check size={9} /></span> Source linked</span><span>{person.since ? `Since ${person.since}` : "Public profile"}</span></div>
  </article>;
}

function TrustStep({ number, icon, title, body }: { number: string; icon: React.ReactNode; title: string; body: string }) {
  return <div className="trust-step"><span className="step-number">{number}</span><span className="step-icon">{icon}</span><div><h3>{title}</h3><p>{body}</p></div><ArrowUpRight size={15} className="step-arrow" /></div>;
}

function ProfileModal({ person, onClose, onSave, saved }: { person: Profile; onClose: () => void; onSave: () => void; saved: boolean }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><button className="modal-close" onClick={onClose} aria-label="Close profile"><X size={18} /></button><div className="modal-overline"><span className="tag-dot" />{person.office}<span className="modal-state">{person.state}</span></div><div className="modal-person"><RepresentativeAvatar person={person} showSpark /><div><h2 id="profile-title">{person.name}</h2><p>{person.party} <span>·</span> {person.constituency}</p></div></div>{person.sample && <div className="sample-warning"><CircleHelp size={15} /> Demonstration profile — details below are fictional and must not be treated as real records.</div>}<p className="modal-summary">{person.summary}</p><div className="modal-info-grid"><div><small>OFFICE</small><b>{person.office}</b></div><div><small>REPRESENTING</small><b>{person.constituency}, {person.state}</b></div><div><small>PARTY</small><b>{person.party}</b></div><div><small>EDUCATION</small><b>{person.education}</b></div></div><div className="modal-section-title"><h3>Election history</h3><span>{person.elections.length} {person.elections.length === 1 ? "record" : "records"}</span></div>{person.elections.length ? person.elections.map((election, i) => <div className="election-row" key={i}><div className="election-year">{election.year}</div><div className="election-detail"><b>{election.electionType} · {election.constituency}</b><small>{election.party} · {election.votes.toLocaleString("en-IN")} votes{election.margin ? ` · won by ${election.margin.toLocaleString("en-IN")}` : ""}</small></div><span className="won-label">{election.result}</span></div>) : <div className="no-election">Election figures are not shown for this office type in this sample.</div>}<div className="modal-section-title sources-title"><h3>Sources</h3><span>Checked {person.sources[0]?.accessedAt ?? "—"}</span></div>{person.sources.map((source, i) => <a className="modal-source" key={i} href={source.url} target="_blank" rel="noreferrer"><span className="source-file"><FileText size={16} /></span><span><b>{source.title}</b><small>{source.publisher} · opens official portal</small></span><ExternalLink size={15} /></a>)}<div className="modal-actions"><button className="primary-button" onClick={onSave}><Bookmark size={15} fill={saved ? "currentColor" : "none"} />{saved ? "Saved" : "Save profile"}</button><button className="modal-done" onClick={onClose}>Done</button></div></section></div>;
}

export default App;
