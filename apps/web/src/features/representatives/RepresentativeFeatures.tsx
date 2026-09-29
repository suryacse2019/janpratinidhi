import { t, locale } from "../../i18n";
import { SiteHeader } from "../../components/SiteHeader";
import React, { useEffect, useRef, useState } from "react";
import {
  AtSign,
  ExternalLink,
  Facebook,
  FileText,
  Instagram,
  Mail,
  Phone,
  Share2,
  Youtube,
  ArrowUpRight,
  ArrowRight,
  Landmark,
} from "lucide-react";
import type { Representative } from "@janpratinidhi/shared";
import { ThemeToggle } from "../directory/PublicPoliticianPage";

type Profile = Representative;
type ExternalProfile = {
  wikipediaUrl?: string;
  wikidataUrl?: string;
  prsUrl?: string;
  sansadUrl?: string;
  sansadRecord?: Record<string, string>;
  sansadHistory?: Array<{ position: string; start?: string; end?: string }>;
  educationSourceUrl?: string;
  educationSourceLabel?: string;
  photoUrl?: string;
  photoSourceUrl?: string;
  partySymbolUrl?: string;
  publicSourceLinks?: Array<{ title: string; url: string }>;
  socialAccounts?: Array<{ platform: string; url: string }>;
  publicEmail?: string;
  publicEmails?: string[];
  publicPhones?: string[];
  summary?: string;
  education: string[];
  history: Array<{ position: string; start?: string; end?: string }>;
  family: Array<{ relation: string; name: string }>;
  performance?: Record<string, string>;
  performancePeriod?: string;
  fetchedAt: string;
};

export function RepresentativeSearchCard({
  person,
  variant = "directory",
  apiUrl,
}: {
  person: Profile;
  variant?: "home" | "directory";
  apiUrl: string;
}) {
  const [cardMedia, setCardMedia] = useState<{ photoUrl?: string; partySymbolUrl?: string }>({
    photoUrl: person.photoUrl,
    partySymbolUrl: person.partySymbolUrl,
  });
  const cardRef = useRef<HTMLElement>(null);
  const profileUrl = `/representatives/${encodeURIComponent(person.slug || person.id)}`;
  useEffect(() => {
    setCardMedia({ photoUrl: person.photoUrl, partySymbolUrl: person.partySymbolUrl });
    if (person.photoUrl && person.partySymbolUrl) return;
    const element = cardRef.current;
    if (!element) return;
    let active = true;
    let requested = false;
    const loadMedia = () => {
      if (requested) return;
      requested = true;
      fetch(`${apiUrl}/representatives/${encodeURIComponent(person.slug || person.id)}/card-media`)
        .then(async (response) => {
          if (!response.ok) return;
          const media = (await response.json()) as { photoUrl?: string; partySymbolUrl?: string };
          if (active)
            setCardMedia((current) => ({
              photoUrl: current.photoUrl || media.photoUrl,
              partySymbolUrl: current.partySymbolUrl || media.partySymbolUrl,
            }));
        })
        .catch(() => undefined);
    };
    if (typeof IntersectionObserver === "undefined") loadMedia();
    else {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            loadMedia();
            observer.disconnect();
          }
        },
        { rootMargin: "300px" },
      );
      observer.observe(element);
      return () => {
        active = false;
        observer.disconnect();
      };
    }
    return () => {
      active = false;
    };
  }, [person.id, person.slug, person.photoUrl, person.partySymbolUrl]);
  const designation = person.office.includes("MP") ? "MP" : person.office === "MLC" ? "MLC" : "MLA";
  return (
    <article
      className={`representative-result-card compact-representative-card ${variant === "home" ? "compact-home-card" : ""}`}
      ref={cardRef}
    >
      <a
        className="compact-card-photo"
        href={profileUrl}
        aria-label={t("View {name} details", { name: person.name })}
      >
        <RepresentativePhoto
          url={cardMedia.photoUrl}
          initials={person.initials}
          name={person.name}
        />
      </a>
      <div className="compact-card-body">
        <div className="compact-card-heading">
          <h3>
            <a href={profileUrl}>{person.name}</a>
          </h3>
          <span className="result-office-tag">{designation}</span>
        </div>
        <div className="compact-card-facts">
          <span>
            <small>{t("Constituency")}</small>
            <b>{person.constituency || t("Not listed")}</b>
          </span>
          <span>
            <small>{t("State")}</small>
            <b>{person.state}</b>
          </span>
        </div>
        <div className="compact-card-footer">
          <div className="compact-card-party">
            <span className="result-party-symbol">
              <PartySymbol
                url={cardMedia.partySymbolUrl}
                party={person.party}
                shortName={person.partyShort}
              />
            </span>
            <span className="compact-party-short">{person.partyShort || "—"}</span>
            <b title={person.party}>{person.party}</b>
          </div>
          <ShareRepresentativeButton name={person.name} url={profileUrl} />
        </div>
      </div>
    </article>
  );
}

function ShareRepresentativeButton({
  name,
  url,
  iconOnly = false,
}: {
  name: string;
  url: string;
  iconOnly?: boolean;
}) {
  const [label, setLabel] = useState("Share");
  const share = async () => {
    const fullUrl = `${window.location.origin}${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} · Jan Pratinidhi`, url: fullUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(fullUrl);
      setLabel("Copied");
      window.setTimeout(() => setLabel("Share"), 1800);
    } catch {
      window.prompt("Copy this profile link", fullUrl);
    }
  };
  return (
    <button
      className={iconOnly ? "detail-share-button" : "compact-share-button"}
      type="button"
      onClick={() => void share()}
      aria-label={
        label === "Copied" ? t("Profile link copied") : t("Share {name} profile", { name })
      }
      title={label === "Copied" ? t("Link copied") : t("Share {name} profile", { name })}
    >
      <Share2 size={16} />
      {!iconOnly && <span>{t(label)}</span>}
    </button>
  );
}

function PartySymbol({
  url,
  party,
  shortName,
}: {
  url?: string;
  party: string;
  shortName: string;
}) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <img src={url} alt={t("{party} symbol", { party })} onError={() => setFailed(true)} />
  ) : (
    <span aria-label={t("No symbol image available for {party}", { party })}>
      {shortName || "—"}
    </span>
  );
}

function RepresentativePhoto({
  url,
  initials,
  name,
}: {
  url?: string;
  initials: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <img
      className="representative-photo"
      src={url}
      alt={t("{name} portrait", { name })}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className="representative-photo photo-fallback"
      role="img"
      aria-label={t("No photo available for {name}", { name })}
    >
      {initials || "—"}
    </span>
  );
}

export function RepresentativeAvatar({
  person,
  tone = "tone-peach",
  showSpark = false,
}: {
  person: Profile;
  tone?: string;
  showSpark?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`avatar ${tone}`}
      role="img"
      aria-label={t("{name} portrait", { name: person.name })}
    >
      {person.photoUrl && !failed ? (
        <img
          src={person.photoUrl}
          alt=""
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{person.initials || "—"}</span>
      )}
      {showSpark && (
        <i className="avatar-spark" aria-hidden="true">
          ✳
        </i>
      )}
    </span>
  );
}

const SUGGEST_INFO_URL = "https://github.com/suryacse2019/janpratinidhi/issues/new";

function readRecordSection(recordData: Profile["recordData"], ...names: string[]): unknown {
  if (!recordData) return undefined;
  const wanted = new Set(names.map((name) => name.toLowerCase().replace(/[^a-z]/g, "")));
  const entry = Object.entries(recordData).find(([key]) =>
    wanted.has(key.toLowerCase().replace(/[^a-z]/g, "")),
  );
  return entry?.[1];
}

function hasRecordValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.some(hasRecordValue);
  if (typeof value === "object")
    return Object.values(value as Record<string, unknown>).some(hasRecordValue);
  return true;
}

function RecordValue({ value }: { value: unknown }) {
  if (Array.isArray(value))
    return (
      <ul className="record-value-list">
        {value.map((item, index) => (
          <li key={index}>
            <RecordValue value={item} />
          </li>
        ))}
      </ul>
    );
  if (value && typeof value === "object")
    return (
      <dl className="record-value-facts">
        {Object.entries(value as Record<string, unknown>)
          .filter(([, item]) => hasRecordValue(item))
          .map(([key, item]) => (
            <div key={key}>
              <dt>{key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ")}</dt>
              <dd>
                <RecordValue value={item} />
              </dd>
            </div>
          ))}
      </dl>
    );
  return <>{typeof value === "boolean" ? (value ? t("Yes") : t("No")) : String(value)}</>;
}

function RepresentativeInfoSection({
  title,
  value,
  sourceUrl,
  sourceLabel = "Wikidata",
  loading = false,
}: {
  title: string;
  value: unknown;
  sourceUrl?: string;
  sourceLabel?: string;
  loading?: boolean;
}) {
  const available = hasRecordValue(value);
  return (
    <section className="representative-detail-card representative-info-section">
      <h2>{t(title)}</h2>
      {available ? (
        <div className="representative-info-value">
          <RecordValue value={value} />
          {sourceUrl && (
            <a className="external-data-source" href={sourceUrl} target="_blank" rel="noreferrer">
              {t("Source:") + " "}
              {sourceLabel} <ExternalLink size={13} />
            </a>
          )}
        </div>
      ) : (
        <div className="info-unavailable">
          <p>
            {loading
              ? t("Searching external sources for a matching profile…")
              : t("Data not available from a matched public source.")}
          </p>
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              {t("Check") + " "}
              {sourceLabel}
              {" " + t("profile") + " "}
              <ExternalLink size={14} />
            </a>
          )}
          <a href={SUGGEST_INFO_URL} target="_blank" rel="noreferrer">
            {t("Help us add this info") + " "}
            <ExternalLink size={14} />
          </a>
        </div>
      )}
    </section>
  );
}

function ContactDetailsSection({
  storedContact,
  profile,
  loading,
}: {
  storedContact: unknown;
  profile: ExternalProfile | null;
  loading: boolean;
}) {
  const hasStored = hasRecordValue(storedContact);
  const emails = [
    ...new Set([
      ...(profile?.publicEmails ?? []),
      ...(profile?.publicEmail ? [profile.publicEmail] : []),
    ]),
  ];
  const phones = [...new Set(profile?.publicPhones ?? [])];
  const hasExternal = Boolean(emails.length || phones.length || profile?.socialAccounts?.length);
  return (
    <section className="representative-detail-card representative-info-section">
      <h2>{t("Contacts & Social Media")}</h2>
      {hasStored || hasExternal ? (
        <div className="contact-details-content">
          {hasStored && (
            <div className="representative-info-value">
              <RecordValue value={storedContact} />
            </div>
          )}
          {emails.map((email) => (
            <a className="contact-account-link" key={`email:${email}`} href={`mailto:${email}`}>
              <Mail size={17} />
              <span>{t("Email")}</span>
              <b>{email}</b>
            </a>
          ))}
          {phones.map((phone) => (
            <a className="contact-account-link" key={`phone:${phone}`} href={`tel:${phone}`}>
              <Phone size={17} />
              <span>{t("Phone")}</span>
              <b>{phone}</b>
            </a>
          ))}
          {profile?.socialAccounts?.map((account) => {
            const Icon =
              account.platform === "Facebook"
                ? Facebook
                : account.platform === "Instagram"
                  ? Instagram
                  : account.platform === "YouTube"
                    ? Youtube
                    : AtSign;
            return (
              <a
                className="contact-account-link"
                key={account.platform}
                href={account.url}
                target="_blank"
                rel="noreferrer"
              >
                <Icon size={17} />
                <span>{account.platform}</span>
                <b>
                  {t("Open profile") + " "}
                  <ExternalLink size={13} />
                </b>
              </a>
            );
          })}
          {profile?.sansadUrl && (
            <a
              className="external-data-source"
              href={profile.sansadUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t("Official parliamentary contact record: Digital Sansad") + " "}
              <ExternalLink size={13} />
            </a>
          )}
          {profile?.wikidataUrl && (
            <a
              className="external-data-source"
              href={profile.wikidataUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t("Public account details: Wikidata") + " "}
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      ) : (
        <div className="info-unavailable">
          <p>
            {loading
              ? t("Checking matched public profiles for published contact links…")
              : t("No matching public email or social account was found.")}
          </p>
          {profile?.wikipediaUrl && (
            <a href={profile.wikipediaUrl} target="_blank" rel="noreferrer">
              {t("Check Wikipedia profile") + " "}
              <ExternalLink size={14} />
            </a>
          )}
          <a href={SUGGEST_INFO_URL} target="_blank" rel="noreferrer">
            {t("Help us add this info") + " "}
            <ExternalLink size={14} />
          </a>
        </div>
      )}
    </section>
  );
}

function formatRelativeUpdate(value: string, now: number): string {
  const elapsed = Math.max(0, now - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return "";
  const relative = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return relative.format(0, "second");
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return relative.format(-days, "day");
  const months = Math.floor(days / 30);
  if (months < 12) return relative.format(-months, "month");
  return relative.format(-Math.floor(months / 12), "year");
}

export function RepresentativeDetailsPage({
  identifier,
  theme,
  isSignedIn = false,
  onToggleTheme,
  apiUrl,
  normalizeRepresentative,
}: {
  identifier: string;
  theme: "light" | "dark";
  isSignedIn?: boolean;
  onToggleTheme: () => void;
  apiUrl: string;
  normalizeRepresentative: (record: Record<string, unknown>) => Profile;
}) {
  const [person, setPerson] = useState<Profile | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [externalProfile, setExternalProfile] = useState<ExternalProfile | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/representatives/${encodeURIComponent(identifier)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Representative not found");
        if (active) setPerson(normalizeRepresentative(body.data));
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Could not load this record");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [identifier]);
  useEffect(() => {
    if (!person) return;
    let active = true;
    setExternalLoading(true);
    fetch(`${apiUrl}/representatives/${encodeURIComponent(identifier)}/external-profile`)
      .then(async (response) => {
        if (!response.ok) throw new Error("External profile lookup failed");
        const body = (await response.json()) as { data: ExternalProfile | null };
        if (active) setExternalProfile(body.data);
      })
      .catch(() => {
        if (active) setExternalProfile(null);
      })
      .finally(() => {
        if (active) setExternalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [identifier, person?.id]);
  const house =
    person?.house ||
    (person?.office === "Lok Sabha MP"
      ? "Lok Sabha"
      : person?.office === "Rajya Sabha MP"
        ? "Rajya Sabha"
        : person?.office === "MLA"
          ? "Vidhan Sabha"
          : "");
  const termStart = person?.termStart || person?.since;
  const termText = termStart
    ? `${termStart}${person?.termEnd ? ` – ${person.termEnd}` : t(" – Present")}`
    : person?.termEnd;
  const profileUpdated = person?.updatedAt ? formatRelativeUpdate(person.updatedAt, now) : "";
  const storedPerformance = readRecordSection(
    person?.recordData,
    "performance",
    "performanceDetails",
  );
  const performance = hasRecordValue(storedPerformance)
    ? storedPerformance
    : externalProfile?.performance
      ? {
          ...externalProfile.performance,
          ...(externalProfile.performancePeriod
            ? { reportingPeriod: externalProfile.performancePeriod }
            : {}),
        }
      : undefined;
  const storedHistory = readRecordSection(
    person?.recordData,
    "history",
    "politicalHistory",
    "careerHistory",
  );
  const externalHistory = [
    ...(externalProfile?.sansadHistory ?? []),
    ...(externalProfile?.history ?? []),
    ...(person?.elections ?? []).map(
      ({ year, electionType, constituency, state, party, result }) => ({
        year,
        electionType,
        constituency,
        state,
        party,
        result,
      }),
    ),
  ];
  const history = hasRecordValue(storedHistory)
    ? storedHistory
    : externalHistory.length
      ? externalHistory
      : undefined;
  const education = person?.education || externalProfile?.education;
  const storedFamily = readRecordSection(person?.recordData, "familyDetails", "family");
  const family = hasRecordValue(storedFamily) ? storedFamily : externalProfile?.family;
  const contact = readRecordSection(person?.recordData, "contact", "contactDetails");
  const additionalRecords = [
    ...Object.entries(person?.recordData ?? {}),
    ...Object.entries(externalProfile?.sansadRecord ?? {}),
  ].filter(
    ([key, value]) =>
      ![
        "performance",
        "performancedetails",
        "history",
        "politicalhistory",
        "careerhistory",
        "family",
        "familydetails",
        "contact",
        "contactdetails",
      ].includes(key.toLowerCase().replace(/[^a-z]/g, "")) && hasRecordValue(value),
  );
  const issueTitle = person
    ? `Correction or missing information: ${person.name}`
    : "Politician information correction";
  const issueBody = person
    ? [
        "## What is incorrect?",
        "Describe the incorrect or missing information here.",
        "",
        "## Suggested correction",
        "Add the correct information here.",
        "",
        "## Additional Notes",
        "Optional notes/screenshots.",
        "",
        `Politician: ${person.name}`,
        `Profile: ${window.location.origin}/representatives/${encodeURIComponent(person.slug || person.id)}`,
      ].join("\n")
    : "## What is incorrect?\n\nDescribe the incorrect or missing information here.\n\n## Suggested correction\n\nAdd the correct information here.\n\n## Additional Notes\n\nOptional notes/screenshots.";
  const issueUrl = `${SUGGEST_INFO_URL}?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;
  const externalSources = [
    ...(externalProfile?.wikipediaUrl
      ? [
          {
            title: "Wikipedia biography",
            url: externalProfile.wikipediaUrl,
            publisher: "Wikipedia",
          },
        ]
      : []),
    ...(externalProfile?.wikidataUrl
      ? [
          {
            title: "Structured profile and public account claims",
            url: externalProfile.wikidataUrl,
            publisher: "Wikidata",
          },
        ]
      : []),
    ...(externalProfile?.prsUrl
      ? [
          {
            title: "Legislative performance and profile",
            url: externalProfile.prsUrl,
            publisher: "PRS Legislative Research",
          },
        ]
      : []),
    ...(externalProfile?.sansadUrl
      ? [
          {
            title: "Official Lok Sabha member profile",
            url: externalProfile.sansadUrl,
            publisher: "Digital Sansad · Lok Sabha Secretariat",
          },
        ]
      : []),
    ...(externalProfile?.publicSourceLinks ?? []).map((source) => ({
      title: source.title,
      url: source.url,
      publisher: "Linked public source",
    })),
  ].filter(
    (source, index, sources) =>
      sources.findIndex((candidate) => candidate.url === source.url) === index,
  );
  const electionResearchQuery = encodeURIComponent(
    `${person?.name ?? ""} ${person?.constituency ?? ""} ${person?.state ?? ""}`.trim(),
  );
  const electionResearchLinks = [
    {
      title: "Search candidate affidavits and profiles",
      url: `https://myneta.info/search_myneta.php?q=${electionResearchQuery}`,
      publisher: "MyNeta / ADR · archived self-declared election information",
    },
    {
      title: "Open IndiaVotes politician directory",
      url: "https://www.indiavotes.com/netas/",
      publisher: "IndiaVotes · election history and results",
    },
    {
      title: "Open ECI Candidate Affidavit Portal",
      url: "https://affidavit.eci.gov.in/",
      publisher: "Election Commission of India · candidate profiles and photos",
    },
    ...(person?.office.includes("MP")
      ? [
          {
            title: "General Election 2024 result e-book",
            url: "https://www.eci.gov.in/EBooks/ge_2024_results_ebook/mobile/index.html",
            publisher: "Election Commission of India · 2024 result reference",
          },
        ]
      : []),
  ];
  const detailTabs = [
    { id: "detail-biography", label: "Biography" },
    { id: "detail-performance", label: "Performance" },
    { id: "detail-history", label: "History" },
    { id: "detail-education", label: "Education" },
    { id: "detail-family", label: "Family" },
    { id: "detail-contacts", label: "Contacts & social" },
    { id: "detail-external-sources", label: "External sources" },
    { id: "detail-election-research", label: "Election research" },
  ];

  return (
    <div className="dashboard-shell profile-route-shell">
      <SiteHeader isSignedIn={isSignedIn} politician>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </SiteHeader>
      <main className="representative-detail-main">
        {loading ? (
          <div className="directory-state" role="status">
            <span className="loading-spinner" />
            {t("Loading representative record…")}
          </div>
        ) : error || !person ? (
          <div className="directory-state error-state" role="alert">
            <h1>{t("Record unavailable")}</h1>
            <p>{error || t("This representative is not in the published directory.")}</p>
            <a href="/politician" className="primary-button">
              {t("Return to politicians") + " "}
              <ArrowRight size={15} />
            </a>
          </div>
        ) : (
          <>
            <a className="dashboard-back-link detail-back" href="/politician">
              {t("← Back to politicians")}
            </a>
            <section className="representative-overview-card">
              <ShareRepresentativeButton
                name={person.name}
                url={`/representatives/${encodeURIComponent(person.slug || person.id)}`}
                iconOnly
              />
              <div className="representative-overview-identity">
                <div className="representative-overview-portrait">
                  <RepresentativePhoto
                    url={person.photoUrl || externalProfile?.photoUrl}
                    initials={person.initials}
                    name={person.name}
                  />
                  {!person.photoUrl && externalProfile?.photoSourceUrl && (
                    <a href={externalProfile.photoSourceUrl} target="_blank" rel="noreferrer">
                      {t("Photo source") + " "}
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <div className="detail-identity">
                  <span className="result-office-tag">{t(person.office)}</span>
                  <h1>{person.name}</h1>
                  <p className="detail-party-line">
                    <span>{person.party}</span>
                    {profileUpdated && (
                      <span
                        className="profile-updated"
                        title={t("Last updated {date}", {
                          date: new Date(person.updatedAt!).toLocaleString(locale()),
                        })}
                      >
                        {t("Updated") + " "}
                        {profileUpdated}
                      </span>
                    )}
                  </p>
                  <div className="detail-symbol">
                    <PartySymbol
                      url={person.partySymbolUrl || externalProfile?.partySymbolUrl}
                      party={person.party}
                      shortName={person.partyShort}
                    />
                  </div>
                </div>
              </div>
              <div className="representative-overview-about">
                <h2>{t("About")}</h2>
                <p>
                  {person.description ||
                    person.summary ||
                    t("A biography has not been added for this representative yet.")}
                </p>
              </div>
              <div className="representative-overview-facts">
                <h2>{t("Details")}</h2>
                <dl className="detail-facts">
                  {person.state && (
                    <div>
                      <dt>{t("State")}</dt>
                      <dd>{person.state}</dd>
                    </div>
                  )}
                  {person.constituency && (
                    <div>
                      <dt>{t("Constituency")}</dt>
                      <dd>{person.constituency}</dd>
                    </div>
                  )}
                  {house && (
                    <div>
                      <dt>{t("House")}</dt>
                      <dd>{t(house)}</dd>
                    </div>
                  )}
                  {termText && (
                    <div>
                      <dt>{t("Term")}</dt>
                      <dd>{termText}</dd>
                    </div>
                  )}
                  {person.electionYear && (
                    <div>
                      <dt>{t("Election year")}</dt>
                      <dd>{person.electionYear}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </section>
            <nav className="representative-detail-tabs" aria-label={t("Politician details")}>
              {detailTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(tab.id)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  {t(tab.label)}
                </button>
              ))}
            </nav>
            <div className="representative-detail-sections">
              <div id="detail-biography" className="representative-detail-anchor">
                <RepresentativeInfoSection
                  title={t("External biography")}
                  value={externalProfile?.summary}
                  sourceUrl={externalProfile?.wikipediaUrl}
                  sourceLabel="Wikipedia · CC BY-SA 4.0"
                  loading={externalLoading}
                />
              </div>
              <div id="detail-performance" className="representative-detail-anchor">
                <RepresentativeInfoSection
                  title={t("Performance")}
                  value={performance}
                  sourceUrl={externalProfile?.prsUrl}
                  sourceLabel="PRS India · CC BY 4.0"
                />
              </div>
              <div id="detail-history" className="representative-detail-anchor">
                <RepresentativeInfoSection
                  title={t("History")}
                  value={history}
                  sourceUrl={externalProfile?.sansadUrl || externalProfile?.wikidataUrl}
                  sourceLabel={externalProfile?.sansadUrl ? "Digital Sansad" : "Wikidata"}
                />
              </div>
              <div id="detail-education" className="representative-detail-anchor">
                <RepresentativeInfoSection
                  title={t("Education")}
                  value={education}
                  sourceUrl={externalProfile?.educationSourceUrl}
                  sourceLabel={externalProfile?.educationSourceLabel ?? "Wikidata"}
                />
              </div>
              <div id="detail-family" className="representative-detail-anchor">
                <RepresentativeInfoSection
                  title={t("Family Details")}
                  value={family}
                  sourceUrl={externalProfile?.wikidataUrl}
                />
              </div>
              <div id="detail-contacts" className="representative-detail-anchor">
                <ContactDetailsSection
                  storedContact={contact}
                  profile={externalProfile}
                  loading={externalLoading}
                />
              </div>
              <section
                id="detail-external-sources"
                className="representative-detail-card representative-detail-anchor"
              >
                <h2>{t("External public sources")}</h2>
                {externalSources.length > 0 ? (
                  <>
                    <p className="external-sources-note">
                      {t(
                        "Links discovered on matched public profiles. Review each source for the latest information.",
                      )}
                    </p>
                    {externalSources.map((source) => (
                      <a
                        className="detail-source-link"
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText size={16} />
                        <span>
                          <b>{t(source.title)}</b>
                          <small>{t(source.publisher)}</small>
                        </span>
                        <ExternalLink size={14} />
                      </a>
                    ))}
                  </>
                ) : (
                  <div className="info-unavailable">
                    <p>{t("No matched external source links are available.")}</p>
                  </div>
                )}
              </section>
              <section
                id="detail-election-research"
                className="representative-detail-card representative-detail-anchor"
              >
                <h2>{t("Election research portals")}</h2>
                <p className="external-sources-note">
                  {t(
                    "Open these portals to check election records and candidate photos. MyNeta records are archived candidate affidavits and may not reflect current status.",
                  )}
                </p>
                {electionResearchLinks.map((source) => (
                  <a
                    className="detail-source-link"
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={16} />
                    <span>
                      <b>{t(source.title)}</b>
                      <small>{t(source.publisher)}</small>
                    </span>
                    <ExternalLink size={14} />
                  </a>
                ))}
              </section>

              <section className="representative-detail-card report-issue-card">
                <div>
                  <h2>{t("Found an issue with this politician’s information?")}</h2>
                  <p>
                    {t(
                      "Report missing or incorrect details. Add a source link when you can so the record can be checked.",
                    )}
                  </p>
                </div>
                <a className="primary-button" href={issueUrl} target="_blank" rel="noreferrer">
                  {t("Report an issue on GitHub") + " "}
                  <ArrowUpRight size={15} />
                </a>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
