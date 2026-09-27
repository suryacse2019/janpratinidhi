import { Router } from "express";
import mongoose from "mongoose";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { RepresentativeModel } from "../models/Representative.js";
import { UserModel } from "../models/User.js";
import { SiteVisitModel } from "../models/SiteVisit.js";
import { ActivityEventModel } from "../models/ActivityEvent.js";
import { syncPartyCatalog, withPartyCatalog } from "../services/partyCatalog.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const editableFields = [
  "name",
  "slug",
  "initials",
  "party",
  "partyShort",
  "office",
  "state",
  "constituency",
  "photoUrl",
  "partySymbolUrl",
  "house",
  "description",
  "termStart",
  "termEnd",
  "electionYear",
  "recordData",
  "since",
  "education",
  "summary",
  "elections",
  "sources",
  "status",
] as const;
function pickEditable(body: Record<string, unknown>) {
  return Object.fromEntries(
    editableFields.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]),
  );
}
function validationError(
  error: unknown,
): error is mongoose.Error.ValidationError | mongoose.Error.CastError {
  return (
    error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError
  );
}

adminRouter.get("/dashboard", async (_req, res, next) => {
  try {
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const weekStart = new Date(today);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const weekStartKey = weekStart.toISOString().slice(0, 10);
    const [users, representatives, published, drafts, visitRows] = await Promise.all([
      UserModel.countDocuments(),
      RepresentativeModel.countDocuments(),
      RepresentativeModel.countDocuments({ status: "published" }),
      RepresentativeModel.countDocuments({ status: "draft" }),
      SiteVisitModel.aggregate<{ _id: string; count: number }>([
        { $match: { day: { $gte: weekStartKey, $lte: todayKey } } },
        { $group: { _id: "$day", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const counts = new Map(visitRows.map(({ _id, count }) => [_id, count]));
    const dailyVisitors = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setUTCDate(date.getUTCDate() + index);
      const day = date.toISOString().slice(0, 10);
      return { date: day, count: counts.get(day) ?? 0 };
    });
    res.json({
      stats: {
        users,
        representatives,
        published,
        drafts,
        todayVisitors: counts.get(todayKey) ?? 0,
        dailyVisitors,
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users", async (_req, res, next) => {
  try {
    const [users, activityRows] = await Promise.all([
      UserModel.find({}, { googleId: 0 }).sort({ createdAt: -1 }).lean(),
      ActivityEventModel.aggregate([
        { $sort: { lastSeenAt: -1, createdAt: -1 } },
        { $group: { _id: "$userId", event: { $first: "$$ROOT" } } },
        {
          $project: {
            _id: 1,
            action: "$event.action",
            details: "$event.details",
            at: { $ifNull: ["$event.lastSeenAt", "$event.createdAt"] },
          },
        },
      ]),
    ]);
    const lastActivityByUser = new Map(
      activityRows.map((row: any) => [
        String(row._id),
        { action: row.action, details: row.details, at: row.at },
      ]),
    );
    const data = users.map((user: any) => ({
      ...user,
      lastActivity: lastActivityByUser.get(String(user._id)) ?? null,
    }));
    res.json({ data, total: data.length });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/activity", async (req, res, next) => {
  try {
    const limit = Math.min(250, Math.max(1, Number(req.query.limit) || 100));
    const filter: Record<string, unknown> = {};
    if (typeof req.query.userId === "string" && mongoose.isValidObjectId(req.query.userId))
      filter.userId = req.query.userId;
    const events = await ActivityEventModel.find(filter)
      .sort({ lastSeenAt: -1, createdAt: -1 })
      .limit(limit)
      .populate("userId", "name email")
      .lean();
    const seenPages = new Set<string>();
    const data = events.filter((event: any) => {
      if (event.action !== "Viewed page") return true;
      const userId =
        typeof event.userId === "object" ? String(event.userId?._id) : String(event.userId);
      const key = `${userId}:${event.details}`;
      if (seenPages.has(key)) return false;
      seenPages.add(key);
      return true;
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/users/:id/status", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: "Invalid user ID" });
    if (req.body?.status !== "active" && req.body?.status !== "inactive")
      return res.status(400).json({ error: "Status must be active or inactive" });
    const user = await UserModel.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "deleted" } },
      { $set: { status: req.body.status } },
      { new: true, runValidators: true },
    );
    if (!user) return res.status(404).json({ error: "User not found or has been deleted" });
    res.json({ data: { id: user._id, email: user.email, status: user.status } });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/users/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: "Invalid user ID" });
    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "deleted", deletedAt: new Date() } },
      { new: true, runValidators: true },
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/representatives", async (_req, res, next) => {
  try {
    const data = await RepresentativeModel.find().sort({ updatedAt: -1 }).lean();
    res.json({ data: await withPartyCatalog(data), total: data.length });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/representatives", async (req, res, next) => {
  try {
    const values = pickEditable(req.body ?? {});
    if (
      values.status === "published" &&
      (!Array.isArray(values.sources) || values.sources.length === 0)
    ) {
      return res
        .status(400)
        .json({ error: "Add at least one source before publishing a representative" });
    }
    const person = await RepresentativeModel.create(values);
    await syncPartyCatalog();
    res.status(201).json({ data: (await withPartyCatalog([person.toObject()]))[0] });
  } catch (error) {
    if (validationError(error)) return res.status(400).json({ error: error.message });
    next(error);
  }
});

adminRouter.patch("/representatives/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: "Invalid representative ID" });
    const changes = pickEditable(req.body ?? {});
    const current = await RepresentativeModel.findById(req.params.id);
    if (!current) return res.status(404).json({ error: "Representative not found" });
    const finalStatus = changes.status ?? current.status;
    const finalSources = changes.sources ?? current.sources;
    if (
      finalStatus === "published" &&
      (!Array.isArray(finalSources) || finalSources.length === 0)
    ) {
      return res
        .status(400)
        .json({ error: "Add at least one source before publishing a representative" });
    }
    const person = await RepresentativeModel.findByIdAndUpdate(
      req.params.id,
      { $set: changes },
      { new: true, runValidators: true },
    );
    if (!person) return res.status(404).json({ error: "Representative not found" });
    if (changes.party !== undefined || changes.partyShort !== undefined) await syncPartyCatalog();
    res.json({ data: (await withPartyCatalog([person.toObject()]))[0] });
  } catch (error) {
    if (validationError(error)) return res.status(400).json({ error: error.message });
    next(error);
  }
});

adminRouter.delete("/representatives/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: "Invalid representative ID" });
    const person = await RepresentativeModel.findByIdAndDelete(req.params.id);
    if (!person) return res.status(404).json({ error: "Representative not found" });
    await syncPartyCatalog();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
