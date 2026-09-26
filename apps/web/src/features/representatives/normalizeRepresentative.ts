import type { Representative } from "@janpratinidhi/shared";

export function normalizeRepresentative(record: Record<string, unknown>): Representative {
  const name = String(record.name ?? "");
  const party = String(record.party ?? "");
  return {
    ...record,
    id: String(record._id ?? record.id ?? ""),
    name,
    initials: String(record.initials ?? name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)),
    party,
    partyShort: String(record.partyShort ?? ""),
    office: record.office as Representative["office"],
    state: String(record.state ?? ""),
    constituency: String(record.constituency ?? ""),
    since: String(record.since ?? ""),
    education: String(record.education ?? ""),
    summary: String(record.summary ?? ""),
    sources: (record.sources ?? []) as Representative["sources"],
    elections: (record.elections ?? []) as Representative["elections"],
  } as Representative;
}
