import { Router } from "express";
import { requireUser } from "../middleware/requireUser.js";
import { RepresentativeModel } from "../models/Representative.js";

export const representativesRouter = Router();

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

representativesRouter.get("/:id", async (req, res, next) => {
  try {
    const identifier = req.params.id;
    const identityFilter = /^[a-f\d]{24}$/i.test(identifier) ? { _id: identifier } : { slug: identifier };
    const person = await RepresentativeModel.findOne({ ...identityFilter, status: "published", sample: { $ne: true } }).lean();
    if (!person) return res.status(404).json({ error: "Representative not found" });
    res.json({ data: person });
  } catch (error) { next(error); }
});
