import React, { useEffect, useState } from "react";
import { ArrowRight, Landmark, Moon, Search, ShieldCheck, Sun } from "lucide-react";
import type { Representative } from "@janpratinidhi/shared";
import { DirectorySearchFilters } from "./DirectorySearchFilters";

export function ThemeToggle({ theme, onToggle }: { theme: "light" | "dark"; onToggle: () => void }) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  return <button className="theme-toggle" type="button" onClick={onToggle} aria-label={`Switch to ${nextTheme} mode`} aria-pressed={theme === "dark"} title={`Switch to ${nextTheme} mode`}>
    {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
  </button>;
}

type Profile = Representative;
type DirectoryFilters = { states: string[]; parties: string[] };
type SearchResponse = { data: Array<Record<string, unknown>>; pagination: { page: number; limit: number; total: number; totalPages: number } };
export function PublicPoliticianPage({ theme, onToggleTheme, apiUrl, normalizeRepresentative, renderCard }: { theme: "light" | "dark"; onToggleTheme: () => void; apiUrl: string; normalizeRepresentative: (record: Record<string, unknown>) => Profile; renderCard: (person: Profile) => React.ReactNode }) {
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
    fetch(`${apiUrl}/representatives/directory-filters`).then(async (response) => {
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
    fetch(`${apiUrl}/representatives?${params}`, { signal: controller.signal }).then(async (response) => {
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
    <header className="dashboard-topbar"><a className="brand" href="/"><span className="brand-mark"><Landmark size={19} /></span><span className="brand-name">Jan Pratinidhi<span>.</span></span></a><div className="theme-header-actions"><ThemeToggle theme={theme} onToggle={onToggleTheme} /><a className="dashboard-back-link" href="/">← Home</a></div></header>
    <main className="dashboard-main">
      <div className="dashboard-breadcrumb"><a href="/">Home</a><span>/</span><b>Explore politicians</b></div>
      <div className="dashboard-title"><div><div className="eyebrow small-eyebrow">PUBLIC DIRECTORY <span className="heading-rule" /></div><h1>Explore politicians</h1><p>Search MPs and MLAs by name, constituency, state, or party.</p></div><span className="dashboard-total">{total.toLocaleString("en-IN")} records</span></div>
      <DirectorySearchFilters query={query} type={type} state={state} party={party} states={filters.states} parties={filters.parties} onQueryChange={setQuery} onTypeChange={(value) => resetPage(setType)(value)} onStateChange={(value) => resetPage(setState)(value)} onPartyChange={(value) => resetPage(setParty)(value)} onSubmit={() => { setDebouncedQuery(query.trim()); setPage(1); }} />
      <div className="results-heading"><div><h2>Politician profiles</h2><p>Showing {records.length ? `${(page - 1) * 50 + 1}–${(page - 1) * 50 + records.length} of ${total.toLocaleString("en-IN")}` : "0"} records</p></div><span>Page {totalPages ? page : 0} of {totalPages}</span></div>
      {loading ? <div className="directory-state" role="status"><span className="loading-spinner" />Loading politician records…</div> : error ? <div className="directory-state error-state" role="alert"><h3>We couldn’t load the directory</h3><p>{error}</p><button onClick={() => setReload((value) => value + 1)}>Try again</button></div> : records.length === 0 ? <div className="directory-state empty-results"><Search size={26} /><h3>No matching politicians</h3><p>Try another search or remove a filter.</p><button onClick={clearFilters}>Clear search and filters</button></div> : <div className="representative-results-grid">{records.map((person) => <React.Fragment key={person.id}>{renderCard(person)}</React.Fragment>)}</div>}
      {!loading && !error && totalPages > 1 && <nav className="pagination-controls" aria-label="Politician directory pages"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button><span>Page {page} of {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next →</button></nav>}
    </main>
  </div>;
}

