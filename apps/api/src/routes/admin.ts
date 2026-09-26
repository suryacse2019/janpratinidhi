import { Router } from "express";
import mongoose from "mongoose";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { RepresentativeModel } from "../models/Representative.js";
import { UserModel } from "../models/User.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const editableFields = ["name", "slug", "initials", "party", "partyShort", "office", "state", "constituency", "photoUrl", "partySymbolUrl", "house", "description", "termStart", "termEnd", "electionYear", "recordData", "since", "education", "summary", "elections", "sources", "status"] as const;
function pickEditable(body: Record<string, unknown>) {
  return Object.fromEntries(editableFields.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
}
function validationError(error: unknown): error is mongoose.Error.ValidationError | mongoose.Error.CastError {
  return error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError;
}

adminRouter.get("/dashboard", async (_req, res, next) => {
  try {
    const [users, representatives, published, drafts] = await Promise.all([
      UserModel.countDocuments(), RepresentativeModel.countDocuments(),
      RepresentativeModel.countDocuments({ status: "published" }), RepresentativeModel.countDocuments({ status: "draft" }),
    ]);
    res.json({ stats: { users, representatives, published, drafts } });
  } catch (error) { next(error); }
});

adminRouter.get("/users", async (_req, res, next) => {
  try {
    const data = await UserModel.find({}, { googleId: 0 }).sort({ createdAt: -1 }).lean();
    res.json({ data, total: data.length });
  } catch (error) { next(error); }
});

adminRouter.patch("/users/:id/status", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid user ID" });
    if (req.body?.status !== "active" && req.body?.status !== "inactive") return res.status(400).json({ error: "Status must be active or inactive" });
    const user = await UserModel.findOneAndUpdate({ _id: req.params.id, status: { $ne: "deleted" } }, { $set: { status: req.body.status } }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: "User not found or has been deleted" });
    res.json({ data: { id: user._id, email: user.email, status: user.status } });
  } catch (error) { next(error); }
});

adminRouter.delete("/users/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid user ID" });
    const user = await UserModel.findByIdAndUpdate(req.params.id, { $set: { status: "deleted", deletedAt: new Date() } }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true });
  } catch (error) { next(error); }
});

adminRouter.get("/representatives", async (_req, res, next) => {
  try {
    const data = await RepresentativeModel.find().sort({ updatedAt: -1 }).lean();
    res.json({ data, total: data.length });
  } catch (error) { next(error); }
});

adminRouter.post("/representatives", async (req, res, next) => {
  try {
    const values = pickEditable(req.body ?? {});
    if (values.status === "published" && (!Array.isArray(values.sources) || values.sources.length === 0)) {
      return res.status(400).json({ error: "Add at least one source before publishing a representative" });
    }
    const person = await RepresentativeModel.create(values);
    res.status(201).json({ data: person });
  } catch (error) {
    if (validationError(error)) return res.status(400).json({ error: error.message });
    next(error);
  }
});

adminRouter.patch("/representatives/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid representative ID" });
    const changes = pickEditable(req.body ?? {});
    const current = await RepresentativeModel.findById(req.params.id);
    if (!current) return res.status(404).json({ error: "Representative not found" });
    const finalStatus = changes.status ?? current.status;
    const finalSources = changes.sources ?? current.sources;
    if (finalStatus === "published" && (!Array.isArray(finalSources) || finalSources.length === 0)) {
      return res.status(400).json({ error: "Add at least one source before publishing a representative" });
    }
    const person = await RepresentativeModel.findByIdAndUpdate(req.params.id, { $set: changes }, { new: true, runValidators: true });
    if (!person) return res.status(404).json({ error: "Representative not found" });
    res.json({ data: person });
  } catch (error) {
    if (validationError(error)) return res.status(400).json({ error: error.message });
    next(error);
  }
});

adminRouter.delete("/representatives/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid representative ID" });
    const person = await RepresentativeModel.findByIdAndDelete(req.params.id);
    if (!person) return res.status(404).json({ error: "Representative not found" });
    res.json({ success: true });
  } catch (error) { next(error); }
});
