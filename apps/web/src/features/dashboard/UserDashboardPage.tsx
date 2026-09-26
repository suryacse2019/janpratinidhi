import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Landmark, Search, ShieldCheck } from "lucide-react";
import type { Representative } from "@janpratinidhi/shared";
import { ThemeToggle } from "../directory/PublicPoliticianPage";
import { ProfileMenu } from "../../components/ProfileMenu";

export function DashboardLoginGate({ theme, onToggleTheme }: { theme: "light" | "dark"; onToggleTheme: () => void }) {
  return <div className="dashboard-login-gate"><div className="login-gate-header"><a className="brand" href="/"><span className="brand-mark"><Landmark size={19} /></span><span className="brand-name">Jan Pratinidhi<span>.</span></span></a><ThemeToggle theme={theme} onToggle={onToggleTheme} /></div><div><ShieldCheck size={30} /><h1>Sign in to your dashboard</h1><p>Use your Google account to search the representative directory.</p><a className="primary-button" href="/">Go to sign in <ArrowRight size={15} /></a></div></div>;
}

type User = { id: string; email: string; name: string; picture?: string; firstName?: string; lastName?: string; phoneNumber?: string; gender?: "female" | "male" | "non_binary" | "prefer_not_to_say" };
type Profile = Representative;
type DirectoryFilters = { states: string[]; parties: string[] };
type SearchResponse = { data: Array<Record<string, unknown>>; pagination: { page: number; limit: number; total: number; totalPages: number } };
export function UserDashboardPage({ user, onSignOut, theme, onToggleTheme, apiUrl, normalizeRepresentative, renderCard }: { user: User; onSignOut: () => void; theme: "light" | "dark"; onToggleTheme: () => void; apiUrl: string; normalizeRepresentative: (record: Record<string, unknown>) => Profile; renderCard: (person: Profile) => React.ReactNode }) {
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
  const [myRepresentatives, setMyRepresentatives] = useState<{ mp: Profile | null; mla: Profile | null }>({ mp: null, mla: null });
  const [saveError, setSaveError] = useState("");
  const [savingPosition, setSavingPosition] = useState<"mp" | "mla" | "">("");
  const [addingPosition, setAddingPosition] = useState<"mp" | "mla" | "">("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 320);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    const credential = sessionStorage.getItem("janpratinidhi-google-token") ?? "";
    fetch(`${apiUrl}/representatives/filters`, { headers: { Authorization: `Bearer ${credential}` } }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load search filters");
      if (active) setFilters(body);
    }).catch(() => { if (active) setFilters({ states: [], parties: [] }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const credential = sessionStorage.getItem("janpratinidhi-google-token") ?? "";
    fetch(`${apiUrl}/representatives/my-representatives`, { headers: { Authorization: `Bearer ${credential}` } })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not load your representatives");
        return body.data as { mp?: Record<string, unknown> | null; mla?: Record<string, unknown> | null };
      })
      .then((data) => { if (active) setMyRepresentatives({ mp: data.mp ? normalizeRepresentative(data.mp) : null, mla: data.mla ? normalizeRepresentative(data.mla) : null }); })
      .catch((reason) => { if (active) setSaveError(reason instanceof Error ? reason.message : "Could not load your representatives"); });
    return () => { active = false; };
  }, [apiUrl]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: "50", type });
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (state) params.set("state", state);
    if (party) params.set("party", party);
    setLoading(true); setError("");
    const credential = sessionStorage.getItem("janpratinidhi-google-token") ?? "";
    fetch(`${apiUrl}/representatives/search?${params}`, { signal: controller.signal, headers: { Authorization: `Bearer ${credential}` } }).then(async (response) => {
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
  const addMyRepresentative = async (position: "mp" | "mla", person: Profile) => {
    setSavingPosition(position); setSaveError("");
    try {
      const credential = sessionStorage.getItem("janpratinidhi-google-token") ?? "";
      const response = await fetch(`${apiUrl}/representatives/my-representatives/${position}`, { method: "PUT", headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" }, body: JSON.stringify({ representativeId: person.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save this representative");
      setMyRepresentatives((current) => ({ ...current, [position]: person }));
      setAddingPosition("");
      setQuery("");
      setDebouncedQuery("");
    } catch (reason) { setSaveError(reason instanceof Error ? reason.message : "Could not save this representative"); }
    finally { setSavingPosition(""); }
  };
  const startAddingRepresentative = (position: "mp" | "mla") => {
    setAddingPosition(position);
    setQuery("");
    setDebouncedQuery("");
    setType(position === "mp" ? "MP" : "MLA");
    setPage(1);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };
  const removeMyRepresentative = async (position: "mp" | "mla") => {
    setSaveError("");
    try {
      const credential = sessionStorage.getItem("janpratinidhi-google-token") ?? "";
      const response = await fetch(`${apiUrl}/representatives/my-representatives/${position}`, { method: "DELETE", headers: { Authorization: `Bearer ${credential}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not remove this representative");
      setMyRepresentatives((current) => ({ ...current, [position]: null }));
    } catch (reason) { setSaveError(reason instanceof Error ? reason.message : "Could not remove this representative"); }
  };
  return <div className="dashboard-shell"><header className="dashboard-topbar"><a className="brand" href="/"><span className="brand-mark"><Landmark size={19} /></span><span className="brand-name">Jan Pratinidhi<span>.</span></span></a><div className="dashboard-header-actions"><ThemeToggle theme={theme} onToggle={onToggleTheme} /><ProfileMenu user={user} onSignOut={onSignOut} /></div></header>
    <main className="dashboard-main"><div className="dashboard-breadcrumb"><a href="/">Home</a><span>/</span><b>Dashboard</b></div><div className="dashboard-title"><div><div className="eyebrow small-eyebrow">YOUR DASHBOARD <span className="heading-rule" /></div><h1>Find your MP / MLA</h1><p>Enter your constituency and select your state to find the MPs and MLAs who represent you.</p></div><span className="dashboard-total">{total.toLocaleString("en-IN")} {total === 1 ? "record" : "records"}</span></div>
      <form id="representative-search" className="representative-search-form" onSubmit={(event) => { event.preventDefault(); setDebouncedQuery(query.trim()); setPage(1); }}><div className="dashboard-search-box"><Search size={19} aria-hidden="true" /><div className="representative-picker-input-wrap"><input ref={searchInputRef} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={addingPosition ? `Search for your ${addingPosition.toUpperCase()} by constituency or name` : "Enter your constituency, person, or party"} aria-label="Search representatives by constituency, person, or party" aria-expanded={Boolean(addingPosition && query.trim())} aria-autocomplete={addingPosition ? "list" : undefined} /><button type="submit" aria-label="Search representatives"><Search size={17} /><span>Search</span></button>{addingPosition && query.trim() && <div className="representative-picker-dropdown" role="listbox" aria-label={`${addingPosition.toUpperCase()} search results`}>{loading ? <div className="representative-picker-message">Searching representatives…</div> : error ? <div className="representative-picker-message">{error}</div> : records.length ? records.map((person) => <RepresentativePickerOption key={person.id} person={person} apiUrl={apiUrl} disabled={savingPosition === addingPosition} onSelect={() => void addMyRepresentative(addingPosition, person)} />) : <div className="representative-picker-message">No matching {addingPosition.toUpperCase()} found. Try another constituency or name.</div>}</div>}</div></div><div className="dashboard-filters"><label>Type<select value={type} disabled={Boolean(addingPosition)} onChange={(event) => resetPage(setType)(event.target.value)}><option value="ALL">All</option><option value="MP">MP</option><option value="MLA">MLA</option></select></label><label>Your state<select value={state} onChange={(event) => resetPage(setState)(event.target.value)}><option value="">All states</option>{filters.states.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Party<select value={party} onChange={(event) => resetPage(setParty)(event.target.value)}><option value="">All parties</option>{filters.parties.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div></form>
      <section className="my-representatives-section" aria-labelledby="my-representatives-title"><div className="my-representatives-heading"><div><div className="eyebrow small-eyebrow">YOUR PICKS <span className="heading-rule" /></div><h2 id="my-representatives-title">My MP and MLA</h2><p>Save the MP and MLA for your constituency so they’re easy to find next time.</p></div></div>{saveError && <p className="my-representatives-error" role="alert">{saveError}</p>}<div className="my-representatives-grid">{(["mp", "mla"] as const).map((position) => {
        const person = myRepresentatives[position];
        return <article className="my-representative-slot" key={position}><div className="my-representative-slot-title"><span>{position.toUpperCase()}</span><b>{position === "mp" ? "Member of Parliament" : "Member of Legislative Assembly"}</b></div>{person ? <><div className="my-representative-person">{renderCard(person)}</div><div className="my-representative-slot-actions"><button className="my-representative-change" onClick={() => startAddingRepresentative(position)}>Change</button><button className="my-representative-remove" onClick={() => void removeMyRepresentative(position)}>Remove</button></div></> : <div className="my-representative-empty"><button className="my-representative-add" onClick={() => startAddingRepresentative(position)} aria-label={`Search to add your ${position.toUpperCase()}`}><span>+</span><b>Add your {position.toUpperCase()}</b></button><small>Choose from the representative search.</small></div>}</article>;
      })}</div></section>
      {!addingPosition && <><div className="results-heading"><div><h2>Representatives</h2><p>Search by constituency, then add an MP or MLA using the slots above.</p></div><span>Page {totalPages ? page : 0} of {totalPages}</span></div>
      {loading ? <div className="directory-state" role="status"><span className="loading-spinner" />Searching the public records…</div> : error ? <div className="directory-state error-state" role="alert"><h3>We couldn’t load the directory</h3><p>{error}</p><button onClick={() => setReload((n) => n + 1)}>Try again</button></div> : records.length === 0 ? <div className="directory-state empty-results"><Search size={26} /><h3>No matching published records</h3><p>Try a different name or clear one of the filters. Only approved records from the database appear here.</p><button onClick={() => { setQuery(""); setDebouncedQuery(""); setType("ALL"); setState(""); setParty(""); setPage(1); }}>Clear search and filters</button></div> : <div className="representative-results-grid">{records.map((person) => <React.Fragment key={person.id}>{renderCard(person)}</React.Fragment>)}</div>}
      {!loading && !error && totalPages > 1 && <nav className="pagination-controls" aria-label="Representative results pages"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button><span>Page {page} of {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next →</button></nav>}
      </>}
    </main>
  </div>;
}


function RepresentativePickerOption({ person, apiUrl, disabled, onSelect }: { person: Profile; apiUrl: string; disabled: boolean; onSelect: () => void }) {
  const [photoUrl, setPhotoUrl] = useState(person.photoUrl);
  const optionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setPhotoUrl(person.photoUrl);
    if (person.photoUrl) return;
    const element = optionRef.current;
    if (!element) return;
    const controller = new AbortController();
    let requested = false;
    let observer: IntersectionObserver | undefined;
    const loadPhoto = () => {
      if (requested) return;
      requested = true;
      fetch(`${apiUrl}/representatives/${encodeURIComponent(person.slug || person.id)}/card-media`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() as Promise<{ photoUrl?: string }> : null)
        .then((media) => { if (!controller.signal.aborted && media?.photoUrl) setPhotoUrl(media.photoUrl); })
        .catch(() => undefined);
    };
    if (typeof IntersectionObserver === "undefined") loadPhoto();
    else {
      const currentObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { loadPhoto(); currentObserver.disconnect(); }
      }, { rootMargin: "40px" });
      observer = currentObserver;
      observer.observe(element);
    }
    return () => { controller.abort(); observer?.disconnect(); };
  }, [apiUrl, person.id, person.slug, person.photoUrl]);
  return <button ref={optionRef} className="representative-picker-option" type="button" role="option" onClick={onSelect} disabled={disabled}><span className="representative-picker-avatar"><span>{person.initials}</span>{photoUrl && <img src={photoUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span><span className="representative-picker-option-info"><b>{person.name}</b><small>{person.office} · {person.constituency || "Constituency not listed"}, {person.state}</small></span><span className="representative-picker-party">{person.partyShort || person.party}</span></button>;
}
