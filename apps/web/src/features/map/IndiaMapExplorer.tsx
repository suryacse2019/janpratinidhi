import { useEffect, useState } from "react";
import { ChevronRight, MapPin, RotateCcw, Search } from "lucide-react";
import { t, locale } from "../../i18n";
import boundaries from "./india-states.json";
import "./IndiaMapExplorer.css";

type Geography = { state: string; constituency: string; office: string; count: number };
export function normalizeState(name: string) {
  const key = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z]/g, "");
  const aliases: Record<string, string> = {
    nctofdelhi: "delhi",
    delhinct: "delhi",
    nationalcapitalterritoryofdelhi: "delhi",
    orissa: "odisha",
    uttaranchal: "uttarakhand",
    pondicherry: "puducherry",
    andamanandnicobar: "andamanandnicobarislands",
  };
  return aliases[key] ?? key;
}

export function IndiaMapExplorer({
  apiUrl,
  state,
  constituency,
  onSelect,
}: {
  apiUrl: string;
  state: string;
  constituency: string;
  onSelect: (state: string, constituency: string) => void;
}) {
  const [data, setData] = useState<Geography[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(`${apiUrl}/representatives/geography`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const body = await response.json();
        setData(body.data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [apiUrl, reload]);
  const stateRows = data.filter((row) => normalizeState(row.state) === normalizeState(state));
  const constituencies = Array.from(
    new Set(stateRows.map((row) => row.constituency).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const selectedCount = stateRows.reduce((sum, row) => sum + row.count, 0);
  const chooseState = (name: string) => {
    const canonical =
      data.find((row) => normalizeState(row.state) === normalizeState(name))?.state ?? name;
    setSearch("");
    onSelect(canonical, "");
  };
  const matches = (name: string) =>
    `${name} ${t(name)}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  return (
    <section className="india-explorer" id="india-map" aria-labelledby="india-map-title">
      <div className="india-explorer-heading">
        <div>
          <div className="eyebrow small-eyebrow">{t("EXPLORE BY LOCATION")}</div>
          <h2 id="india-map-title">{t("Find your place. Meet your representatives.")}</h2>
          <p>
            {t(
              "Select a state, choose a constituency, and explore published representatives below.",
            )}
          </p>
        </div>
        <MapPin aria-hidden="true" size={28} />
      </div>
      <div className="india-explorer-grid">
        <div className="india-map-canvas">
          <svg viewBox="0 0 560 630" role="group" aria-label={t("Interactive India state map")}>
            {boundaries.map((item) => (
              <path
                key={item.name}
                d={item.path}
                role="button"
                tabIndex={0}
                className={normalizeState(state) === normalizeState(item.name) ? "selected" : ""}
                aria-label={t(item.name)}
                aria-pressed={normalizeState(state) === normalizeState(item.name)}
                onMouseEnter={() => setHovered(item.name)}
                onMouseLeave={() => setHovered("")}
                onFocus={() => setHovered(item.name)}
                onBlur={() => setHovered("")}
                onClick={() => chooseState(item.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    chooseState(item.name);
                  }
                }}
              >
                <title>{t(item.name)}</title>
              </path>
            ))}
          </svg>
          <div className="india-map-caption" aria-live="polite">
            <MapPin size={15} />
            {t(hovered || state || "Choose a state on the map")}
          </div>
          <small className="india-map-attribution">
            {t("Map:")}{" "}
            <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">
              geoBoundaries / DataMeet
            </a>{" "}
            ·{" "}
            <a
              href="https://creativecommons.org/licenses/by/2.5/in/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 2.5 IN
            </a>
            <br />
            {t("Simplified state boundaries for browsing; not a constituency boundary map.")}
          </small>
        </div>
        <div className="india-map-browser">
          <nav className="india-map-breadcrumb" aria-label={t("Location selection")}>
            <button
              type="button"
              onClick={() => {
                onSelect("", "");
                setSearch("");
              }}
            >
              {t("India")}
            </button>
            {state && (
              <>
                <ChevronRight size={14} />
                <span>{t(state)}</span>
              </>
            )}
          </nav>
          <h3>{state ? t("Choose a constituency") : t("States & union territories")}</h3>
          <p>
            {state
              ? t("{count} published records", { count: selectedCount })
              : t("Use the map or the searchable list.")}
          </p>
          <label className="india-map-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t(state ? "Search constituencies" : "Search states")}
              aria-label={t(state ? "Search constituencies" : "Search states")}
            />
          </label>
          {loading ? (
            <p role="status">{t("Loading locations…")}</p>
          ) : error ? (
            <div role="alert">
              <p>{t("Could not load location records.")}</p>
              <button type="button" onClick={() => setReload((value) => value + 1)}>
                {t("Try again")}
              </button>
            </div>
          ) : (
            <div className="india-location-list">
              {state && (
                <button
                  type="button"
                  aria-pressed={!constituency}
                  className={!constituency ? "selected" : ""}
                  onClick={() => onSelect(state, "")}
                >
                  <span>{t("All constituencies")}</span>
                  <b>{selectedCount}</b>
                </button>
              )}
              {(state ? constituencies : boundaries.map((item) => item.name))
                .filter(matches)
                .map((name) => {
                  const count = data
                    .filter((row) =>
                      state
                        ? normalizeState(row.state) === normalizeState(state) &&
                          row.constituency === name
                        : normalizeState(row.state) === normalizeState(name),
                    )
                    .reduce((sum, row) => sum + row.count, 0);
                  return (
                    <button
                      type="button"
                      key={name}
                      className={state && constituency === name ? "selected" : ""}
                      aria-pressed={state ? constituency === name : false}
                      onClick={() => (state ? onSelect(state, name) : chooseState(name))}
                    >
                      <span>{t(name)}</span>
                      <b>{count}</b>
                      <ChevronRight size={14} />
                    </button>
                  );
                })}
              {state && constituencies.length === 0 && (
                <p className="india-map-empty">
                  {t(
                    "No constituency records published for this state yet. All state records are shown below.",
                  )}
                </p>
              )}
              {(state ? constituencies : boundaries.map((item) => item.name)).length > 0 &&
                !(state ? constituencies : boundaries.map((item) => item.name)).some(matches) && (
                  <p role="status">{t("No matching options")}</p>
                )}
            </div>
          )}
          {state && (
            <button
              className="india-map-reset"
              type="button"
              onClick={() => {
                onSelect("", "");
                setSearch("");
              }}
            >
              <RotateCcw size={14} />
              {t("Choose another state")}
            </button>
          )}
          <p className="india-map-note">
            {t(
              "Counts reflect published records, not all elected seats. State-level offices may have no constituency.",
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
