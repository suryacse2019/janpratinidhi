import { Router } from "express";
import { requireUser } from "../middleware/requireUser.js";
import { recordUserActivity } from "../services/activityLog.js";

const pageNames: Record<string, string> = {
  home: "Home page",
  directory: "Politician directory",
  representative: "Politician profile",
  dashboard: "User dashboard",
};

export const activityRouter = Router();
activityRouter.post("/page-view", requireUser, async (req, res) => {
  const page = typeof req.body?.page === "string" ? pageNames[req.body.page] : undefined;
  if (!page) return res.status(400).json({ error: "Unknown page" });
  await recordUserActivity(res.locals.authenticatedUserId, "Viewed page", page);
  res.status(202).json({ recorded: true });
});
