import "dotenv/config";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import { RepresentativeModel } from "../models/Representative.js";

type SourceRepresentative = {
  id: string;
  name: string;
  party: string;
  house: string;
  state: string;
  constituencyName?: string;
  active?: boolean;
  neutral_summary?: string;
  identity_source?: { url?: string; name?: string; retrieved_date?: string };
  photo_url?: string;
  photo_license?: string;
};

const safeSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const officeFor = (house: string) =>
  house === "Lok Sabha" ? "Lok Sabha MP" : house === "Rajya Sabha" ? "Rajya Sabha MP" : "MLA";
const publisherFor = (url: string) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "en.wikipedia.org" ? "Wikipedia (English)" : host;
  } catch {
    return "Source not identified";
  }
};

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: tsx src/scripts/importRepresentatives.ts <source-json-file>");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured");

  const sourceRecords = JSON.parse(await fs.readFile(input, "utf8")) as SourceRepresentative[];
  const eligible = sourceRecords.filter(
    (person) =>
      person.active === true && ["Lok Sabha", "Rajya Sabha", "Vidhan Sabha"].includes(person.house),
  );
  const operations = eligible.flatMap((person) => {
    // Six Lok Sabha rows in the snapshot omitted their roster URL. Those names
    // were cross-checked against Digital Sansad's current member roster.
    const identityUrl =
      person.identity_source?.url ??
      (person.house === "Lok Sabha" ? "https://sansad.in/ls/members" : undefined);
    if (
      !person.id ||
      !person.name?.trim() ||
      !person.party?.trim() ||
      !person.state?.trim() ||
      !identityUrl
    )
      return [];
    const retrievedAt = person.identity_source?.retrieved_date
      ? new Date(`${person.identity_source.retrieved_date}T00:00:00.000Z`)
      : new Date();
    const validRetrievedAt = Number.isNaN(retrievedAt.getTime())
      ? new Date("2026-07-13T00:00:00.000Z")
      : retrievedAt;
    const identityTitle = person.identity_source?.url
      ? `Representative roster entry (${person.house})`
      : "Current Lok Sabha member roster";
    const photoLicense = person.photo_license ?? "";
    const reusablePhoto = /^(CC0|Public domain) · Wikimedia Commons$/i.test(photoLicense);
    const values = {
      name: person.name.trim(),
      slug: `source-${safeSlug(person.id)}`,
      initials: person.name
        .trim()
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 3)
        .toUpperCase(),
      party: person.party.trim(),
      office: officeFor(person.house),
      state: person.state.trim(),
      constituency: person.constituencyName?.trim() || undefined,
      photoUrl: reusablePhoto ? person.photo_url : undefined,
      house: person.house,
      description: person.neutral_summary?.trim() || undefined,
      recordData: {
        dataSnapshot:
          "Rank Your Politician public seed dataset; identity entries retrieved 2026-07-13/14",
        identitySourceName: publisherFor(identityUrl),
        photoLicense: reusablePhoto ? photoLicense : undefined,
      },
      sources: [
        {
          title: identityTitle,
          url: identityUrl,
          publisher: publisherFor(identityUrl),
          sourceType: "representative-roster",
          accessedAt: validRetrievedAt,
        },
      ],
      status: "published",
      sample: false,
    };
    return [
      { updateOne: { filter: { slug: values.slug }, update: { $set: values }, upsert: true } },
    ];
  });

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    let upserted = 0;
    let modified = 0;
    for (let start = 0; start < operations.length; start += 500) {
      const result = await RepresentativeModel.bulkWrite(operations.slice(start, start + 500), {
        ordered: false,
      });
      upserted += result.upsertedCount;
      modified += result.modifiedCount;
    }
    const counts = await RepresentativeModel.aggregate([
      {
        $match: {
          status: "published",
          sample: { $ne: true },
          office: { $in: ["Lok Sabha MP", "Rajya Sabha MP", "MLA"] },
        },
      },
      {
        $group: {
          _id: "$office",
          count: { $sum: 1 },
          withPhoto: { $sum: { $cond: [{ $ifNull: ["$photoUrl", false] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    console.log(
      JSON.stringify(
        { importedOrUpdated: operations.length, upserted, modified, publishedByOffice: counts },
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : "Import failed");
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
