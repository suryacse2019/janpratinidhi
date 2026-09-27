import { createHash } from "node:crypto";
import { Router } from "express";
import { SiteVisitModel } from "../models/SiteVisit.js";

export const analyticsRouter = Router();

analyticsRouter.post("/visit", async (req, res, next) => {
  const visitorId = req.body?.visitorId;
  if (typeof visitorId !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(visitorId)) {
    return res.status(400).json({ error: "A valid anonymous visitor ID is required" });
  }
  try {
    const day = new Date().toISOString().slice(0, 10);
    const visitorHash = createHash("sha256").update(visitorId).digest("hex");
    const dailyVisitId = `${day}:${visitorHash}`;
    await SiteVisitModel.updateOne({ _id: dailyVisitId }, { $setOnInsert: { day, visitorHash } }, { upsert: true });
    res.status(202).json({ recorded: true });
  } catch (error) { next(error); }
});
