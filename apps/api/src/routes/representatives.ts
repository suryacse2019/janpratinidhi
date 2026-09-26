import { Router } from "express";
import { requireUser } from "../middleware/requireUser.js";
import { RepresentativeModel } from "../models/Representative.js";

export const representativesRouter = Router();

type ExternalProfile = {
  wikipediaUrl?: string;
  wikidataUrl?: string;
  prsUrl?: string;
  educationSourceUrl?: string;
  educationSourceLabel?: string;
  summary?: string;
  education: string[];
  history: Array<{ position: string; start?: string; end?: string }>;
  family: Array<{ relation: string; name: string }>;
  performance?: Record<string, string>;
  performancePeriod?: string;
  prsEducation?: string[];
  fetchedAt: string;
};
const externalProfileCache = new Map<string, { expiresAt: number; value: ExternalProfile | null }>();
const prsPerformanceCache = new Map<string, { expiresAt: number; value: Pick<ExternalProfile, "prsUrl" | "performance" | "performancePeriod" | "prsEducation"> | null }>();
const normalizePersonName = (value: string) => value.toLowerCase().replace(/\b(shri|smt|dr|mr|mrs|ms|hon|honourable)\b/g, " ").replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
async function wikipediaProfile(person: { name: string; state: string; party: string }): Promise<ExternalProfile | null> {
  const key = `${normalizePersonName(person.name)}|${normalizePersonName(person.state)}`;
  const cached = externalProfileCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const fetchJson = async (url: URL) => {
    const response = await fetch(url, { headers: { "User-Agent": "Janpratinidhi/1.0 (public representative directory; https://janpratinidhi.org)" }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`Wikimedia returned ${response.status}`);
    return response.json() as Promise<Record<string, any>>;
  };
  try {
    const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
    searchUrl.search = new URLSearchParams({ action: "query", list: "search", srsearch: `intitle:\"${person.name}\" politician ${person.party} ${person.state}`, srlimit: "5", format: "json", origin: "*" }).toString();
    const search = await fetchJson(searchUrl);
    const hits = (search.query?.search ?? []) as Array<{ title: string }>;
    const exact = hits.find(({ title }) => normalizePersonName(title) === normalizePersonName(person.name));
    if (!exact) { externalProfileCache.set(key, { expiresAt: Date.now() + 6 * 60 * 60_000, value: null }); return null; }

    const pageUrl = new URL("https://en.wikipedia.org/w/api.php");
    pageUrl.search = new URLSearchParams({ action: "query", prop: "extracts|pageprops", exintro: "1", explaintext: "1", titles: exact.title, format: "json", origin: "*" }).toString();
    const pageResult = await fetchJson(pageUrl);
    const page = Object.values(pageResult.query?.pages ?? {})[0] as { extract?: string; pageprops?: { wikibase_item?: string } } | undefined;
    const summary = String(page?.extract ?? "").trim();
    const contextTerms = [person.state, person.party].map((value) => value.trim().toLowerCase()).filter((value) => value.length >= 4);
    const contextMatches = contextTerms.some((value) => summary.toLowerCase().includes(value));
    if (!summary || !/politician|member of parliament|member of the .*legislative|chief minister|minister/i.test(summary) || !contextMatches) {
      externalProfileCache.set(key, { expiresAt: Date.now() + 6 * 60 * 60_000, value: null }); return null;
    }

    const profile: ExternalProfile = { wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(exact.title.replace(/ /g, "_"))}`, summary, education: [], history: [], family: [], fetchedAt: new Date().toISOString() };
    const qid = page?.pageprops?.wikibase_item;
    if (qid && /^Q\d+$/.test(qid)) {
      profile.wikidataUrl = `https://www.wikidata.org/wiki/${qid}`;
      const entityUrl = new URL("https://www.wikidata.org/w/api.php");
      entityUrl.search = new URLSearchParams({ action: "wbgetentities", ids: qid, props: "claims", format: "json", origin: "*" }).toString();
      const entityResult = await fetchJson(entityUrl);
      const claims = entityResult.entities?.[qid]?.claims ?? {};
      const readIds = (property: string) => ((claims[property] ?? []) as Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } }; qualifiers?: Record<string, Array<{ datavalue?: { value?: { time?: string } } }>> }>).flatMap((claim) => {
        const id = claim.mainsnak?.datavalue?.value?.id;
        if (!id || !/^Q\d+$/.test(id)) return [];
        const time = (qualifier: string) => claim.qualifiers?.[qualifier]?.[0]?.datavalue?.value?.time?.replace(/^\+/, "").slice(0, 11).replace(/T.*$/, "");
        return [{ id, start: time("P580"), end: time("P582") }];
      });
      const educationIds = readIds("P69");
      const historyIds = readIds("P39");
      const familyIds = readIds("P26");
      const allIds = [...new Set([...educationIds, ...historyIds, ...familyIds].map((item) => item.id))];
      if (allIds.length) {
        const labelsUrl = new URL("https://www.wikidata.org/w/api.php");
        labelsUrl.search = new URLSearchParams({ action: "wbgetentities", ids: allIds.slice(0, 50).join("|"), props: "labels", languages: "en", format: "json", origin: "*" }).toString();
        const labelsResult = await fetchJson(labelsUrl);
        const labelFor = (id: string) => String(labelsResult.entities?.[id]?.labels?.en?.value ?? "");
        profile.education = educationIds.map(({ id }) => labelFor(id)).filter(Boolean);
        profile.history = historyIds.map(({ id, start, end }) => ({ position: labelFor(id), start, end })).filter((item) => item.position).slice(0, 12);
        profile.family = familyIds.map(({ id }) => ({ relation: "Spouse", name: labelFor(id) })).filter((item) => item.name);
      }
    }
    externalProfileCache.set(key, { expiresAt: Date.now() + 24 * 60 * 60_000, value: profile });
    if (externalProfileCache.size > 5000) externalProfileCache.delete(externalProfileCache.keys().next().value!);
    return profile;
  } catch {
    return null;
  }
}

async function prsPerformance(person: { name: string; office: string; state: string }): Promise<Pick<ExternalProfile, "prsUrl" | "performance" | "performancePeriod" | "prsEducation"> | null> {
  if (!person.office.includes("MP") && person.office !== "MLA") return null;
  const cacheKey = `${person.office}|${normalizePersonName(person.state)}|${normalizePersonName(person.name)}`;
  const cached = prsPerformanceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const housePath = person.office === "Rajya Sabha MP" ? "rajya-sabha" : person.office === "MLA" ? "mlatrack" : "18-lok-sabha";
  const slug = normalizePersonName(person.name).replace(/\s+/g, "-");
  const prsUrl = person.office === "MLA" ? `https://prsindia.org/mlatrack/${slug}` : `https://prsindia.org/mptrack/${housePath}/${slug}`;
  try {
    const response = await fetch(prsUrl, { headers: { "User-Agent": "Janpratinidhi/1.0 (public representative directory; https://janpratinidhi.org)" }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) { prsPerformanceCache.set(cacheKey, { expiresAt: Date.now() + 6 * 60 * 60_000, value: null }); return null; }
    const html = await response.text();
    const text = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<\/(?:p|div|li|h[1-6]|tr|td|th|section|br)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim();
    const normalizedText = normalizePersonName(text);
    if (!normalizedText.includes(normalizePersonName(person.name)) || !normalizedText.includes(normalizePersonName(person.state))) { prsPerformanceCache.set(cacheKey, { expiresAt: Date.now() + 6 * 60 * 60_000, value: null }); return null; }
    const selectedMember = person.office === "MLA" ? "Selected MLA" : "Selected MP";
    const metric = (label: string) => {
      const match = text.match(new RegExp(`${label}[\\s\\S]{0,350}?${selectedMember}\\s+([\\d.]+\\s*%?)`, "i"));
      return match?.[1]?.replace(/\s+/g, " ").trim();
    };
    const performance: Record<string, string> = {};
    const attendance = metric("Attendance");
    const debates = metric(person.office === "MLA" ? "Debates" : "No\\.? of Debates");
    const questions = metric(person.office === "MLA" ? "Questions" : "No\\.? of Questions");
    const bills = person.office === "MLA" ? undefined : metric("Private Member['’]s Bills");
    if (attendance) performance.attendance = attendance;
    if (debates) performance.debates = debates;
    if (questions) performance.questions = questions;
    if (bills) performance.privateMemberBills = bills;
    const education = text.match(/Education\s*:?\s*(.{2,80}?)(?=Parliamentary Activity|Legislative Assembly Activity|Detailed Information|$)/i)?.[1]?.trim();
    const prsEducation = education && !/^(info not available|not available|n\/a)$/i.test(education) ? [education] : undefined;
    if (!Object.keys(performance).length && !prsEducation?.length) { prsPerformanceCache.set(cacheKey, { expiresAt: Date.now() + 6 * 60 * 60_000, value: null }); return null; }
    const period = text.match(/Data corresponds to the period from ([^.]{5,80})/i)?.[1]?.trim();
    const value = { prsUrl, performance: Object.keys(performance).length ? performance : undefined, performancePeriod: period, prsEducation };
    prsPerformanceCache.set(cacheKey, { expiresAt: Date.now() + 24 * 60 * 60_000, value });
    if (prsPerformanceCache.size > 5000) prsPerformanceCache.delete(prsPerformanceCache.keys().next().value!);
    return value;
  } catch {
    return null;
  }
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const addTextSearch = (filter: Record<string, unknown>, value: string) => {
  if (!value.trim()) return;
  const pattern = { $regex: escapeRegex(value.trim().slice(0, 100)), $options: "i" };
  filter.$or = [{ name: pattern }, { party: pattern }, { state: pattern }, { constituency: pattern }];
};

representativesRouter.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const party = typeof req.query.party === "string" ? req.query.party : "";
    const type = typeof req.query.type === "string" ? req.query.type.toUpperCase() : "ALL";
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 50);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) return res.status(400).json({ error: "page must be positive and limit must be between 1 and 50" });
    if (!["ALL", "MP", "MLA"].includes(type)) return res.status(400).json({ error: "type must be ALL, MP, or MLA" });
    if (state.length > 100 || party.length > 100) return res.status(400).json({ error: "Filter values are too long" });
    const filter: Record<string, unknown> = { status: "published", sample: { $ne: true } };
    if (state) filter.state = state;
    if (party) filter.party = party;
    if (type === "MP") filter.office = { $in: ["Lok Sabha MP", "Rajya Sabha MP"] };
    else if (type === "MLA") filter.office = "MLA";
    else filter.office = { $in: ["Lok Sabha MP", "Rajya Sabha MP", "MLA"] };
    addTextSearch(filter, q);
    const [data, total] = await Promise.all([
      RepresentativeModel.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      RepresentativeModel.countDocuments(filter),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

representativesRouter.get("/directory-filters", async (_req, res, next) => {
  try {
    const filter = { status: "published", sample: { $ne: true }, office: { $in: ["Lok Sabha MP", "Rajya Sabha MP", "MLA"] } };
    const [states, parties] = await Promise.all([
      RepresentativeModel.distinct("state", filter), RepresentativeModel.distinct("party", filter),
    ]);
    res.json({ states: states.filter(Boolean).sort(), parties: parties.filter(Boolean).sort() });
  } catch (error) { next(error); }
});

representativesRouter.get("/filters", requireUser, async (_req, res, next) => {
  try {
    const filter = { status: "published", sample: { $ne: true }, office: { $in: ["Lok Sabha MP", "Rajya Sabha MP", "MLA"] } };
    const [states, parties] = await Promise.all([
      RepresentativeModel.distinct("state", filter), RepresentativeModel.distinct("party", filter),
    ]);
    res.json({ states: states.filter(Boolean).sort(), parties: parties.filter(Boolean).sort() });
  } catch (error) { next(error); }
});

representativesRouter.get("/search", requireUser, async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const party = typeof req.query.party === "string" ? req.query.party : "";
    const type = typeof req.query.type === "string" ? req.query.type.toUpperCase() : "ALL";
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    if (!["ALL", "MP", "MLA"].includes(type)) return res.status(400).json({ error: "type must be ALL, MP, or MLA" });
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) return res.status(400).json({ error: "page must be positive and limit must be between 1 and 50" });
    if (state.length > 100 || party.length > 100) return res.status(400).json({ error: "Filter values are too long" });
    const filter: Record<string, unknown> = { status: "published", sample: { $ne: true } };
    if (state) filter.state = state;
    if (party) filter.party = party;
    if (type === "MP") filter.office = { $in: ["Lok Sabha MP", "Rajya Sabha MP"] };
    else if (type === "MLA") filter.office = "MLA";
    else filter.office = { $in: ["Lok Sabha MP", "Rajya Sabha MP", "MLA"] };
    addTextSearch(filter, q);
    const [data, total] = await Promise.all([
      RepresentativeModel.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      RepresentativeModel.countDocuments(filter),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

representativesRouter.get("/:id/external-profile", async (req, res, next) => {
  try {
    const identifier = req.params.id;
    const personQuery = /^[a-f\d]{24}$/i.test(identifier)
      ? RepresentativeModel.findById(identifier).where({ status: "published", sample: { $ne: true } })
      : RepresentativeModel.findOne({ slug: identifier, status: "published", sample: { $ne: true } });
    const person = await personQuery.select("name state party office").lean() as unknown as { name?: unknown; state?: unknown; party?: unknown; office?: unknown } | null;
    if (!person) return res.status(404).json({ error: "Representative not found" });
    const identity = { name: String(person.name ?? ""), state: String(person.state ?? ""), party: String(person.party ?? "") };
    const [wikipedia, performance] = await Promise.all([
      wikipediaProfile(identity),
      prsPerformance({ ...identity, office: String(person.office ?? "") }),
    ]);
    const hasWikidataEducation = Boolean(wikipedia?.education?.length);
    const data: ExternalProfile | null = wikipedia || performance ? { wikipediaUrl: wikipedia?.wikipediaUrl, wikidataUrl: wikipedia?.wikidataUrl, prsUrl: performance?.prsUrl, educationSourceUrl: hasWikidataEducation ? wikipedia?.wikidataUrl : performance?.prsUrl, educationSourceLabel: hasWikidataEducation ? "Wikidata" : performance?.prsEducation?.length ? "PRS India" : undefined, summary: wikipedia?.summary, education: hasWikidataEducation ? wikipedia?.education ?? [] : performance?.prsEducation ?? [], history: wikipedia?.history ?? [], family: wikipedia?.family ?? [], performance: performance?.performance, performancePeriod: performance?.performancePeriod, fetchedAt: wikipedia?.fetchedAt ?? new Date().toISOString() } : null;
    res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400").json({ data });
  } catch (error) { next(error); }
});

representativesRouter.get("/:id", async (req, res, next) => {
  try {
    const identifier = req.params.id;
    const identityFilter = /^[a-f\d]{24}$/i.test(identifier) ? { _id: identifier } : { slug: identifier };
    const person = await RepresentativeModel.findOne({ ...identityFilter, status: "published", sample: { $ne: true } }).lean();
    if (!person) return res.status(404).json({ error: "Representative not found" });
    res.json({ data: person });
  } catch (error) { next(error); }
});
