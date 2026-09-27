import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { verifyAdminSession } from "../auth/adminSession.js";

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (
      !process.env.ADMIN_EMAIL ||
      !process.env.ADMIN_PASSWORD ||
      !process.env.ADMIN_SESSION_SECRET
    )
      return res.status(503).json({ error: "Admin login is not configured" });
    const authorization = req.header("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const session = verifyAdminSession(token);
    if (!session) return res.status(401).json({ error: "Admin session expired. Sign in again." });
    if (session.email !== process.env.ADMIN_EMAIL?.trim().toLowerCase())
      return res.status(401).json({ error: "Admin account changed. Sign in again." });
    if (mongoose.connection.readyState !== 1)
      return res.status(503).json({ error: "Database is unavailable" });
    next();
  } catch (error) {
    next(error);
  }
}
