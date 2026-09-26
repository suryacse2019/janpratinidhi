import { PartyModel } from "../models/Party.js";
import { RepresentativeModel } from "../models/Representative.js";

/** Keep the catalog seeded from all stored representatives, including unpublished records. */
export async function syncPartyCatalog(): Promise<void> {
  const parties = await RepresentativeModel.aggregate<{ _id: string; shortName?: string }>([
    { $match: { party: { $type: "string", $ne: "" } } },
    { $group: { _id: { $trim: { input: "$party" } }, shortName: { $first: "$partyShort" } } },
  ]);
  for (const party of parties) {
    if (!party._id) continue;
    await PartyModel.updateOne({ name: party._id }, { $setOnInsert: { name: party._id }, ...(party.shortName?.trim() ? { $set: { shortName: party.shortName.trim() } } : {}) }, { upsert: true });
    if (party.shortName?.trim()) await PartyModel.updateOne({ name: party._id }, { $set: { shortName: party.shortName.trim() } });
  }
  const names = parties.map(({ _id }) => _id).filter(Boolean);
  await PartyModel.deleteMany(names.length ? { name: { $nin: names } } : {});
}

export async function withPartyCatalog<T>(records: T[]): Promise<Array<T & { partyShort: string }>> {
  const rows = records as Array<T & { party?: string; partyShort?: string }>;
  const names = [...new Set(rows.map(({ party }) => party?.trim()).filter((name): name is string => Boolean(name)))];
  if (!names.length) return rows.map((record) => ({ ...record, partyShort: "" }));
  const parties = await PartyModel.find({ name: { $in: names } }, { name: 1, shortName: 1 }).lean();
  const shortNames = new Map(parties.map(({ name, shortName }) => [name, shortName ?? ""]));
  return rows.map((record) => ({ ...record, partyShort: shortNames.get(record.party?.trim() ?? "") ?? "" }));
}
