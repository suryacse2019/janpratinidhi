import { Router } from "express";
import { requireUser } from "../middleware/requireUser.js";
import { RepresentativeModel } from "../models/Representative.js";
import { PartyModel } from "../models/Party.js";
import { UserModel } from "../models/User.js";
import { withPartyCatalog } from "../services/partyCatalog.js";
import { recordUserActivity } from "../services/activityLog.js";

export const representativesRouter = Router();

representativesRouter.get("/my-representatives", requireUser, async (_req, res, next) => {
  try {
    const user: any = await UserModel.findById(res.locals.authenticatedUserId)
      .populate({ path: "savedRepresentatives.mp", match: { status: "published", sample: { $ne: true } } })
      .populate({ path: "savedRepresentatives.mla", match: { status: "published", sample: { $ne: true } } }).lean();
    if (!user) return res.status(404).json({ error: "User account not found" });
    const selected = user.savedRepresentatives as { mp?: unknown; mla?: unknown } | undefined;
    const [mp, mla] = await Promise.all([
      selected?.mp ? withPartyCatalog([selected.mp as { party?: string }]) : Promise.resolve([]),
      selected?.mla ? withPartyCatalog([selected.mla as { party?: string }]) : Promise.resolve([]),
    ]);
    res.json({ data: { mp: mp[0] ?? null, mla: mla[0] ?? null } });
  } catch (error) { next(error); }
});

representativesRouter.put("/my-representatives/:position", requireUser, async (req, res, next) => {
  try {
    const position = req.params.position;
    if (position !== "mp" && position !== "mla") return res.status(400).json({ error: "Position must be mp or mla" });
    const representativeId = req.body?.representativeId;
    if (typeof representativeId !== "string" || !/^[a-f\d]{24}$/i.test(representativeId)) return res.status(400).json({ error: "A valid representative ID is required" });
    const officeFilter = position === "mp" ? { $in: ["Lok Sabha MP", "Rajya Sabha MP"] } : "MLA";
    const person: any = await RepresentativeModel.findOne({ _id: representativeId, status: "published", sample: { $ne: true }, office: officeFilter }).lean();
    if (!person) return res.status(404).json({ error: `Published ${position.toUpperCase()} not found` });
    const user: any = await UserModel.findByIdAndUpdate(res.locals.authenticatedUserId, { $set: { [`savedRepresentatives.${position}`]: person._id } }, { new: true })
      .populate({ path: "savedRepresentatives.mp", match: { status: "published", sample: { $ne: true } } })
      .populate({ path: "savedRepresentatives.mla", match: { status: "published", sample: { $ne: true } } });
    if (!user) return res.status(404).json({ error: "User account not found" });
    await recordUserActivity(String(user._id), "Saved representative", `${position.toUpperCase()}: ${person.name}`);
    res.json({ success: true });
  } catch (error) { next(error); }
});

representativesRouter.delete("/my-representatives/:position", requireUser, async (req, res, next) => {
  try {
    const position = req.params.position;
    if (position !== "mp" && position !== "mla") return res.status(400).json({ error: "Position must be mp or mla" });
    const user = await UserModel.findByIdAndUpdate(res.locals.authenticatedUserId, { $unset: { [`savedRepresentatives.${position}`]: 1 } });
    if (!user) return res.status(404).json({ error: "User account not found" });
    await recordUserActivity(String(user._id), "Removed saved representative", position.toUpperCase());
    res.json({ success: true });
  } catch (error) { next(error); }
});

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
  sansadUrl?: string;
  sansadRecord?: Record<string, string>;
  sansadHistory?: Array<{ position: string; start?: string; end?: string }>;
  photoUrl?: string;
  photoSourceUrl?: string;
  partySymbolUrl?: string;
  publicSourceLinks?: Array<{ title: string; url: string }>;
  socialAccounts?: Array<{ platform: string; url: string }>;
  publicEmail?: string;
  publicEmails?: string[];
  publicPhones?: string[];
  fetchedAt: string;
};
const externalProfileCache = new Map<string, { expiresAt: number; value: ExternalProfile | null }>();
const partyImageCache = new Map<string, { expiresAt: number; url?: string }>();
const prsPerformanceCache = new Map<string, { expiresAt: number; value: Pick<ExternalProfile, "prsUrl" | "performance" | "performancePeriod" | "prsEducation"> | null }>();
const sansadProfileCache = new Map<string, { expiresAt: number; value: Pick<ExternalProfile, "sansadUrl" | "sansadRecord" | "sansadHistory" | "photoUrl" | "photoSourceUrl" | "education" | "publicEmail" | "publicEmails" | "publicPhones" | "socialAccounts"> | null }>();
const normalizePersonName = (value: string) => value.toLowerCase().replace(/\b(shri|smt|dr|mr|mrs|ms|hon|honourable)\b/g, " ").replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const normalizeCivicLocation = (value: string) => normalizePersonName(value).replace(/^nct of delhi$/, "delhi").replace(/^delhi nct$/, "delhi");

type SansadContacts = Pick<ExternalProfile, "publicEmail" | "publicEmails" | "publicPhones" | "socialAccounts">;
const socialHosts: Record<string, string> = { facebook: "facebook.com", instagram: "instagram.com", twitter: "x.com", x: "x.com", youtube: "youtube.com", linkedin: "linkedin.com", threads: "threads.net", telegram: "t.me", whatsapp: "wa.me" };

function extractSansadContacts(record: Record<string, unknown>): SansadContacts {
  const values: Array<{ key: string; value: string }> = [];
  const visit = (value: unknown, key = "", depth = 0) => {
    if (depth > 5 || value == null) return;
    if (typeof value === "string" || typeof value === "number") { values.push({ key, value: String(value) }); return; }
    if (Array.isArray(value)) { for (const item of value) visit(item, key, depth + 1); return; }
    if (typeof value === "object") for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) visit(child, childKey, depth + 1);
  };
  visit(record);
  const emailCandidates = values.filter(({ key, value }) => /email|mail/i.test(key) || /\[at\]|\(at\)|@/i.test(value));
  const emails = emailCandidates.flatMap(({ value }) => value.split(/[;,\s]+/).map((email) => email.trim()
    .replace(/\[(at|dot)\]/gi, (_part, token: string) => token.toLowerCase() === "at" ? "@" : ".")
    .replace(/\((at|dot)\)/gi, (_part, token: string) => token.toLowerCase() === "at" ? "@" : ".")))
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const publicEmails = [...new Set(emails.map((email) => email.toLowerCase()))];

  const phones = values.filter(({ key }) => /phone|mobile|telephone|tel|contactnumber|address/i.test(key))
    .flatMap(({ value }) => value.match(/(?:\+?91[\s().-]?)?0?[6-9](?:[\s().-]?\d){9}/g) ?? [])
    .map((phone) => phone.replace(/[\s().-]/g, "").replace(/^0(?=\d{10}$)/, ""));
  const publicPhones = [...new Set(phones)];

  const socials = new Map<string, { platform: string; url: string }>();
  for (const { key, value } of values) {
    const normalizedKey = key.toLowerCase();
    let platformKey = Object.keys(socialHosts).find((candidate) => normalizedKey.includes(candidate));
    let url: string | undefined;
    try {
      const candidate = new URL(value.startsWith("www.") ? `https://${value}` : value);
      if (candidate.protocol !== "https:") continue;
      const hostPlatform = Object.keys(socialHosts).find((candidateKey) => candidate.hostname === socialHosts[candidateKey] || candidate.hostname.endsWith(`.${socialHosts[candidateKey]}`));
      if (hostPlatform) { platformKey = hostPlatform; url = candidate.toString(); }
    } catch { /* A handle may be built into a platform URL below. */ }
    if (!platformKey) continue;
    if (!url) {
      const handle = value.trim().replace(/^@/, "");
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(handle)) continue;
      const host = socialHosts[platformKey];
      url = `https://${host}/${encodeURIComponent(handle)}`;
    }
    const platform = platformKey === "x" || platformKey === "twitter" ? "X / Twitter" : platformKey[0].toUpperCase() + platformKey.slice(1);
    socials.set(url, { platform, url });
  }
  const officialEmail = publicEmails.find((email) => /@(?:mpls\.)?sansad\.nic\.in$/i.test(email)) ?? publicEmails.find((email) => /@sansad\.nic\.in$/i.test(email));
  return { publicEmail: officialEmail ?? publicEmails[0], publicEmails, publicPhones, socialAccounts: [...socials.values()] };
}

async function sansadMember(person: { name: string; state: string; party: string; constituency: string; office: string }): Promise<Pick<ExternalProfile, "sansadUrl" | "sansadRecord" | "sansadHistory" | "photoUrl" | "photoSourceUrl" | "education" | "publicEmail" | "publicEmails" | "publicPhones" | "socialAccounts"> | null> {
  if (person.office !== "Lok Sabha MP") return null;
  const key = `${normalizePersonName(person.name)}|${normalizeCivicLocation(person.state)}|${normalizePersonName(person.constituency)}`;
  const cached = sansadProfileCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const apiUrl = new URL("https://sansad.in/api_ls/member");
    apiUrl.search = new URLSearchParams({ loksabha: "18", state: "", party: "", gender: "", ageFrom: "", ageTo: "", noOfTerms: "", page: "1", size: "30", searchText: person.name, constituency: "", sitting: "1", locale: "en", month: "", profession: "", otherProfession: "", constituencyCategory: "", positionCode: "", qualification: "", noOfChildren: "", isFreedomFighter: "", memberStatus: "s" }).toString();
    const response = await fetch(apiUrl, { headers: { "User-Agent": "Janpratinidhi/1.0 (public representative directory; https://janpratinidhi.org)", Accept: "application/json, text/plain, */*", Referer: "https://sansad.in/ls/members" }, signal: AbortSignal.timeout(6500) });
    if (!response.ok) throw new Error(`Sansad returned ${response.status}`);
    const payload = await response.json() as unknown;
    type MemberRow = { mpsno?: number; mpFirstLastName?: string; mpLastFirstName?: string; firstName?: string; lastName?: string; stateName?: string; constName?: string; partyFname?: string; partySname?: string; status?: string; imageUrl?: string; email?: string[] | string; qualification?: string; profession?: string; profession2?: string; noOfTerms?: number; age?: number; lsExpr?: string };
    const collectRows = (value: unknown): MemberRow[] => {
      if (Array.isArray(value)) {
        if (value.some((item) => item && typeof item === "object" && "mpsno" in item)) return value as MemberRow[];
        return value.flatMap(collectRows);
      }
      if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(collectRows);
      return [];
    };
    const candidateRows = collectRows(payload).filter((row) => {
      const names = [row.mpFirstLastName, row.mpLastFirstName, [row.firstName, row.lastName].filter(Boolean).join(" ")].filter(Boolean);
      return names.some((name) => normalizePersonName(String(name)) === normalizePersonName(person.name))
        && normalizeCivicLocation(String(row.stateName ?? "")) === normalizeCivicLocation(person.state)
        && normalizePersonName(String(row.constName ?? "")) === normalizePersonName(person.constituency);
    });
    const member = candidateRows.find((row) => normalizePersonName(String(row.partyFname ?? "")) === normalizePersonName(person.party)) ?? candidateRows[0];
    if (!member?.mpsno) { sansadProfileCache.set(key, { expiresAt: Date.now() + 6 * 60 * 60_000, value: null }); return null; }
    const sansadUrl = `https://sansad.in/ls/members/biography/${member.mpsno}?from=members`;
    const photoUrl = member.imageUrl && /^https:\/\/sansad\.in\//i.test(member.imageUrl) ? member.imageUrl : undefined;
    const contacts = extractSansadContacts(member as unknown as Record<string, unknown>);
    const termNumbers = [...new Set((String(member.lsExpr ?? "").match(/\d+/g) ?? []).map(Number).filter((term) => term > 0 && term <= 18))].sort((a, b) => a - b);
    const lokSabhaYears: Record<number, [string, string?]> = { 1: ["1952", "1957"], 2: ["1957", "1962"], 3: ["1962", "1967"], 4: ["1967", "1970"], 5: ["1971", "1977"], 6: ["1977", "1980"], 7: ["1980", "1984"], 8: ["1984", "1989"], 9: ["1989", "1991"], 10: ["1991", "1996"], 11: ["1996", "1998"], 12: ["1998", "1999"], 13: ["1999", "2004"], 14: ["2004", "2009"], 15: ["2009", "2014"], 16: ["2014", "2019"], 17: ["2019", "2024"], 18: ["2024"] };
    const sansadHistory = termNumbers.map((term) => {
      const [start, end] = lokSabhaYears[term];
      const ordinal = `${term}${term % 10 === 1 && term % 100 !== 11 ? "st" : term % 10 === 2 && term % 100 !== 12 ? "nd" : term % 10 === 3 && term % 100 !== 13 ? "rd" : "th"}`;
      return { position: `${ordinal} Lok Sabha membership`, start, end };
    });
    const sansadRecord: Record<string, string> = {};
    if (member.status) sansadRecord.membershipStatus = member.status;
    if (member.partySname) sansadRecord.partyAbbreviation = member.partySname;
    if (member.noOfTerms) sansadRecord.lokSabhaTermsServed = String(member.noOfTerms);
    if (member.profession?.trim()) sansadRecord.profession = member.profession.trim();
    if (member.profession2?.trim()) sansadRecord.otherProfession = member.profession2.trim();
    if (member.age) sansadRecord.age = String(member.age);
    const value = { sansadUrl, sansadRecord, sansadHistory, photoUrl, photoSourceUrl: photoUrl ? sansadUrl : undefined, education: member.qualification?.trim() ? [member.qualification.trim()] : [], ...contacts };
    sansadProfileCache.set(key, { expiresAt: Date.now() + 24 * 60 * 60_000, value });
    if (sansadProfileCache.size > 5000) sansadProfileCache.delete(sansadProfileCache.keys().next().value!);
    return value;
  } catch {
    return null;
  }
}
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
    pageUrl.search = new URLSearchParams({ action: "query", prop: "extracts|pageprops|pageimages|extlinks", exintro: "1", explaintext: "1", piprop: "thumbnail", pithumbsize: "512", ellimit: "30", titles: exact.title, format: "json", origin: "*" }).toString();
    const pageResult = await fetchJson(pageUrl);
    const page = Object.values(pageResult.query?.pages ?? {})[0] as { extract?: string; pageprops?: { wikibase_item?: string }; thumbnail?: { source?: string }; extlinks?: Array<{ "*"?: string }> } | undefined;
    const summary = String(page?.extract ?? "").trim();
    const contextTerms = [person.state, person.party].map((value) => value.trim().toLowerCase()).filter((value) => value.length >= 4);
    const contextMatches = contextTerms.some((value) => summary.toLowerCase().includes(value));
    if (!summary || !/politician|member of parliament|member of the .*legislative|chief minister|minister/i.test(summary) || !contextMatches) {
      externalProfileCache.set(key, { expiresAt: Date.now() + 6 * 60 * 60_000, value: null }); return null;
    }

    const profile: ExternalProfile = { wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(exact.title.replace(/ /g, "_"))}`, summary, education: [], history: [], family: [], fetchedAt: new Date().toISOString() };
    const sourceHostAllowed = (hostname: string) => hostname === "sansad.in" || hostname.endsWith(".sansad.in") || hostname === "prsindia.org" || hostname.endsWith(".prsindia.org") || hostname === "eci.gov.in" || hostname.endsWith(".eci.gov.in") || hostname.endsWith(".gov.in") || hostname.endsWith(".nic.in") || hostname === "facebook.com" || hostname.endsWith(".facebook.com") || hostname === "instagram.com" || hostname.endsWith(".instagram.com") || hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "x.com" || hostname.endsWith(".x.com") || hostname === "twitter.com" || hostname.endsWith(".twitter.com");
    profile.publicSourceLinks = (page?.extlinks ?? []).flatMap(({ "*": rawUrl }) => {
      try {
        if (!rawUrl) return [];
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== "https:" || !sourceHostAllowed(parsed.hostname.toLowerCase())) return [];
        return [{ title: parsed.hostname.replace(/^www\./, ""), url: parsed.toString() }];
      } catch { return []; }
    }).filter((link, index, links) => links.findIndex((candidate) => candidate.url === link.url) === index).slice(0, 15);
    if (page?.thumbnail?.source) {
      profile.photoUrl = page.thumbnail.source;
      profile.photoSourceUrl = profile.wikipediaUrl;
    }
    const qid = page?.pageprops?.wikibase_item;
    if (qid && /^Q\d+$/.test(qid)) {
      profile.wikidataUrl = `https://www.wikidata.org/wiki/${qid}`;
      const entityUrl = new URL("https://www.wikidata.org/w/api.php");
      entityUrl.search = new URLSearchParams({ action: "wbgetentities", ids: qid, props: "claims", format: "json", origin: "*" }).toString();
      const entityResult = await fetchJson(entityUrl);
      const claims = entityResult.entities?.[qid]?.claims ?? {};
      const firstStringClaim = (property: string): string | undefined => {
        const claimsForProperty = claims[property] as Array<{ mainsnak?: { datavalue?: { value?: unknown } } }> | undefined;
        const value = claimsForProperty?.map((claim) => claim.mainsnak?.datavalue?.value).find((item) => typeof item === "string");
        return typeof value === "string" ? value.trim() : undefined;
      };
      const usernameClaim = (property: string) => firstStringClaim(property)?.replace(/^@/, "").trim();
      const twitter = usernameClaim("P2002");
      const facebook = usernameClaim("P2013");
      const instagram = usernameClaim("P2003");
      const youtube = firstStringClaim("P2397");
      const socialAccounts: Array<{ platform: string; url: string }> = [];
      if (twitter && /^[A-Za-z0-9_]{1,50}$/.test(twitter)) socialAccounts.push({ platform: "X / Twitter", url: `https://x.com/${encodeURIComponent(twitter)}` });
      if (facebook && /^[A-Za-z0-9.\-_]{1,100}$/.test(facebook)) socialAccounts.push({ platform: "Facebook", url: `https://www.facebook.com/${encodeURIComponent(facebook)}` });
      if (instagram && /^[A-Za-z0-9._]{1,30}$/.test(instagram)) socialAccounts.push({ platform: "Instagram", url: `https://www.instagram.com/${encodeURIComponent(instagram)}/` });
      if (youtube && /^[A-Za-z0-9_-]{10,}$/.test(youtube)) socialAccounts.push({ platform: "YouTube", url: `https://www.youtube.com/channel/${encodeURIComponent(youtube)}` });
      profile.socialAccounts = socialAccounts;
      const email = firstStringClaim("P968")?.replace(/^mailto:/i, "");
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) profile.publicEmail = email;
      const photo = firstStringClaim("P18")?.replace(/^File:/i, "");
      if (photo && !profile.photoUrl) {
        const encodedPhoto = encodeURIComponent(photo.replace(/ /g, "_"));
        profile.photoUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedPhoto}?width=512`;
        profile.photoSourceUrl = `https://commons.wikimedia.org/wiki/File:${encodedPhoto}`;
      }
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

async function wikipediaPartyImage(party: string): Promise<string | undefined> {
  const key = normalizePersonName(party);
  const cached = partyImageCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  try {
    const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
    searchUrl.search = new URLSearchParams({ action: "query", list: "search", srsearch: `intitle:\"${party}\" political party India`, srlimit: "5", format: "json", origin: "*" }).toString();
    const searchResponse = await fetch(searchUrl, { headers: { "User-Agent": "Janpratinidhi/1.0 (public representative directory; https://janpratinidhi.org)" }, signal: AbortSignal.timeout(6000) });
    if (!searchResponse.ok) throw new Error(`Wikipedia returned ${searchResponse.status}`);
    const search = await searchResponse.json() as Record<string, any>;
    const match = (search.query?.search ?? []).find((item: { title?: string }) => normalizePersonName(item.title ?? "") === key);
    if (!match?.title) { partyImageCache.set(key, { expiresAt: Date.now() + 12 * 60 * 60_000 }); return undefined; }
    const imageUrl = new URL("https://en.wikipedia.org/w/api.php");
    imageUrl.search = new URLSearchParams({ action: "query", prop: "pageimages", piprop: "thumbnail", pithumbsize: "256", titles: match.title, format: "json", origin: "*" }).toString();
    const imageResponse = await fetch(imageUrl, { headers: { "User-Agent": "Janpratinidhi/1.0 (public representative directory; https://janpratinidhi.org)" }, signal: AbortSignal.timeout(6000) });
    if (!imageResponse.ok) throw new Error(`Wikipedia returned ${imageResponse.status}`);
    const imageData = await imageResponse.json() as Record<string, any>;
    const page = Object.values(imageData.query?.pages ?? {})[0] as { thumbnail?: { source?: string } } | undefined;
    const url = page?.thumbnail?.source;
    partyImageCache.set(key, { expiresAt: Date.now() + 24 * 60 * 60_000, url });
    if (partyImageCache.size > 1000) partyImageCache.delete(partyImageCache.keys().next().value!);
    return url;
  } catch { return undefined; }
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
async function findPartyGroupedPage(filter: Record<string, unknown>, page: number, limit: number) {
  const groups = await RepresentativeModel.aggregate([
    { $match: filter as any },
    { $group: { _id: "$party", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]) as Array<{ _id: string; count: number }>;
  const partyOrder = groups.map(({ _id }) => _id);
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const data = partyOrder.length ? await RepresentativeModel.aggregate([
    { $match: filter as any },
    { $addFields: { __partySortRank: { $indexOfArray: [partyOrder, "$party"] } } },
    { $sort: { __partySortRank: 1, name: 1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $project: { __partySortRank: 0 } },
  ]) : [];
  return { data, total };
}

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
    const { data, total } = await findPartyGroupedPage(filter, page, limit);
    res.json({ data: await withPartyCatalog(data), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

representativesRouter.get("/directory-filters", async (_req, res, next) => {
  try {
    const filter = { status: "published", sample: { $ne: true }, office: { $in: ["Lok Sabha MP", "Rajya Sabha MP", "MLA"] } };
    const [states, parties] = await Promise.all([
      RepresentativeModel.distinct("state", filter), PartyModel.distinct("name"),
    ]);
    res.json({ states: states.filter(Boolean).sort(), parties: parties.filter(Boolean).sort() });
  } catch (error) { next(error); }
});

representativesRouter.get("/filters", requireUser, async (_req, res, next) => {
  try {
    const filter = { status: "published", sample: { $ne: true }, office: { $in: ["Lok Sabha MP", "Rajya Sabha MP", "MLA"] } };
    const [states, parties] = await Promise.all([
      RepresentativeModel.distinct("state", filter), PartyModel.distinct("name"),
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
    const { data, total } = await findPartyGroupedPage(filter, page, limit);
    const filterDetails = [type !== "ALL" ? type : "", state, party].filter(Boolean).join(" · ");
    await recordUserActivity(res.locals.authenticatedUserId, "Searched representatives", filterDetails || "All representatives");
    res.json({ data: await withPartyCatalog(data), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

representativesRouter.get("/:id/card-media", async (req, res, next) => {
  try {
    const identifier = req.params.id;
    const personQuery = /^[a-f\d]{24}$/i.test(identifier)
      ? RepresentativeModel.findById(identifier).where({ status: "published", sample: { $ne: true } })
      : RepresentativeModel.findOne({ slug: identifier, status: "published", sample: { $ne: true } });
    const person = await personQuery.select("name state party constituency office photoUrl partySymbolUrl").lean() as unknown as { name?: unknown; state?: unknown; party?: unknown; constituency?: unknown; office?: unknown; photoUrl?: unknown; partySymbolUrl?: unknown } | null;
    if (!person) return res.status(404).json({ error: "Representative not found" });
    const identity = { name: String(person.name ?? ""), state: String(person.state ?? ""), party: String(person.party ?? ""), constituency: String(person.constituency ?? ""), office: String(person.office ?? "") };
    const [externalProfile, sansad, partySymbolUrl] = await Promise.all([
      person.photoUrl ? Promise.resolve(null) : wikipediaProfile(identity),
      sansadMember(identity),
      person.partySymbolUrl ? Promise.resolve(undefined) : wikipediaPartyImage(String(person.party ?? "")),
    ]);
    res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400").json({
      photoUrl: person.photoUrl || sansad?.photoUrl || externalProfile?.photoUrl,
      photoSourceUrl: sansad?.photoSourceUrl || externalProfile?.photoSourceUrl,
      partySymbolUrl: person.partySymbolUrl || partySymbolUrl,
    });
  } catch (error) { next(error); }
});

representativesRouter.get("/:id/external-profile", async (req, res, next) => {
  try {
    const identifier = req.params.id;
    const personQuery = /^[a-f\d]{24}$/i.test(identifier)
      ? RepresentativeModel.findById(identifier).where({ status: "published", sample: { $ne: true } })
      : RepresentativeModel.findOne({ slug: identifier, status: "published", sample: { $ne: true } });
    const person = await personQuery.select("name state party office constituency").lean() as unknown as { name?: unknown; state?: unknown; party?: unknown; office?: unknown; constituency?: unknown } | null;
    if (!person) return res.status(404).json({ error: "Representative not found" });
    const identity = { name: String(person.name ?? ""), state: String(person.state ?? ""), party: String(person.party ?? "") };
    const [wikipedia, performance, partySymbolUrl, sansad] = await Promise.all([
      wikipediaProfile(identity),
      prsPerformance({ ...identity, office: String(person.office ?? "") }),
      wikipediaPartyImage(identity.party),
      sansadMember({ ...identity, office: String(person.office ?? ""), constituency: String(person.constituency ?? "") }),
    ]);
    const hasWikidataEducation = Boolean(wikipedia?.education?.length);
    const hasSansadEducation = Boolean(sansad?.education.length);
    const socialAccounts = [...(sansad?.socialAccounts ?? []), ...(wikipedia?.socialAccounts ?? [])].filter((account, index, accounts) => accounts.findIndex((candidate) => candidate.url === account.url) === index);
    const publicEmails = [...new Set([...(sansad?.publicEmails ?? []), ...(wikipedia?.publicEmail ? [wikipedia.publicEmail] : [])])];
    const data: ExternalProfile | null = wikipedia || performance || partySymbolUrl || sansad ? { wikipediaUrl: wikipedia?.wikipediaUrl, wikidataUrl: wikipedia?.wikidataUrl, prsUrl: performance?.prsUrl, sansadUrl: sansad?.sansadUrl, sansadRecord: sansad?.sansadRecord, sansadHistory: sansad?.sansadHistory, educationSourceUrl: hasSansadEducation ? sansad?.sansadUrl : hasWikidataEducation ? wikipedia?.wikidataUrl : performance?.prsUrl, educationSourceLabel: hasSansadEducation ? "Digital Sansad" : hasWikidataEducation ? "Wikidata" : performance?.prsEducation?.length ? "PRS India" : undefined, photoUrl: sansad?.photoUrl || wikipedia?.photoUrl, photoSourceUrl: sansad?.photoSourceUrl || wikipedia?.photoSourceUrl, partySymbolUrl, publicSourceLinks: wikipedia?.publicSourceLinks ?? [], socialAccounts, publicEmail: sansad?.publicEmail || wikipedia?.publicEmail, publicEmails, publicPhones: sansad?.publicPhones ?? [], summary: wikipedia?.summary, education: hasSansadEducation ? sansad?.education ?? [] : hasWikidataEducation ? wikipedia?.education ?? [] : performance?.prsEducation ?? [], history: wikipedia?.history ?? [], family: wikipedia?.family ?? [], performance: performance?.performance, performancePeriod: performance?.performancePeriod, fetchedAt: wikipedia?.fetchedAt ?? new Date().toISOString() } : null;
    res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400").json({ data });
  } catch (error) { next(error); }
});

representativesRouter.get("/:id", async (req, res, next) => {
  try {
    const identifier = req.params.id;
    const identityFilter = /^[a-f\d]{24}$/i.test(identifier) ? { _id: identifier } : { slug: identifier };
    const person = await RepresentativeModel.findOne({ ...identityFilter, status: "published", sample: { $ne: true } }).lean();
    if (!person) return res.status(404).json({ error: "Representative not found" });
    res.json({ data: (await withPartyCatalog([person]))[0] });
  } catch (error) { next(error); }
});
