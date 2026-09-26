import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { verifyGoogleCredential } from "../routes/auth.js";
import { UserModel } from "../models/User.js";

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const authorization = req.header("authorization") ?? "";
    const credential = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const claims = await verifyGoogleCredential(credential);
    if (!claims?.sub) return res.status(401).json({ error: "Sign in with Google to search representatives" });
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "User database is unavailable" });
    const user = await UserModel.findOne({ googleId: claims.sub }).select("_id status profileComplete").lean() as { _id?: unknown; status?: string; profileComplete?: boolean } | null;
    if (!user || user.status !== "active") return res.status(403).json({ error: "This account is inactive or deleted" });
    if (!user.profileComplete) return res.status(403).json({ error: "Complete your profile to search representatives" });
    res.locals.authenticatedUserId = String(user._id);
    next();
  } catch (error) { next(error); }
}
