import { Router } from "express";
import mongoose from "mongoose";
import { constantTimeEqual, createAdminSession, verifyAdminSession } from "../auth/adminSession.js";
import { UserModel } from "../models/User.js";
import { recordUserActivity } from "../services/activityLog.js";

type GoogleClaims = { aud?: string; sub?: string; email?: string; email_verified?: string; name?: string; picture?: string };
const failedAdminAttempts = new Map<string, { count: number; blockedUntil: number }>();

export async function verifyGoogleCredential(credential: unknown): Promise<GoogleClaims | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (typeof credential !== "string" || !clientId) return null;
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!response.ok) return null;
  const claims = await response.json() as GoogleClaims;
  return claims.aud === clientId && claims.sub && claims.email && claims.email_verified === "true" ? claims : null;
}

export const authRouter = Router();

authRouter.post("/google", async (req, res, next) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: "Google sign-in is not configured" });
    if (typeof req.body?.credential !== "string") return res.status(400).json({ error: "Google credential is required" });
    const claims = await verifyGoogleCredential(req.body.credential);
    if (!claims?.sub || !claims.email) return res.status(401).json({ error: "Google account verification failed" });
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "User database is unavailable; sign-in could not be saved" });
    const email = claims.email.toLowerCase();
    let user: any = await UserModel.findOne({ googleId: claims.sub });
    if (user && user.status !== "active") return res.status(403).json({ error: user.status === "deleted" ? "This account has been deleted. Contact an administrator." : "This account is inactive. Contact an administrator." });
    if (!user) {
      try {
        user = await UserModel.create({ googleId: claims.sub, email, name: claims.name ?? email, picture: claims.picture, lastLoginAt: new Date(), profileComplete: false, status: "active" });
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
        user = await UserModel.findOne({ googleId: claims.sub });
        if (!user || user.status !== "active") return res.status(403).json({ error: "This account cannot sign in. Contact an administrator." });
      }
    } else {
      user.email = email; user.name = user.profileComplete ? user.name : (claims.name ?? email); user.picture = claims.picture; user.lastLoginAt = new Date();
      await user.save();
    }
    await recordUserActivity(String(user._id), "Signed in with Google");
    res.json({ user: { id: user._id, email: user.email, name: user.name, picture: user.picture, firstName: user.firstName, lastName: user.lastName, phoneNumber: user.phoneNumber, gender: user.gender, profileComplete: user.profileComplete, status: user.status } });
  } catch (error) { next(error); }
});

authRouter.post("/complete-profile", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "User database is unavailable" });
    const claims = await verifyGoogleCredential(req.body?.credential);
    if (!claims?.sub || !claims.email) return res.status(401).json({ error: "Google sign-in expired. Sign in again." });
    const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
    const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
    const phoneNumber = typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber.trim() : "";
    const gender = req.body?.gender;
    if (firstName.length < 1 || firstName.length > 80 || lastName.length < 1 || lastName.length > 80) return res.status(400).json({ error: "Enter a first name and last name (up to 80 characters each)" });
    if (!/^\+?[0-9\s()-]{10,20}$/.test(phoneNumber) || phoneNumber.replace(/\D/g, "").length < 10 || phoneNumber.replace(/\D/g, "").length > 15) return res.status(400).json({ error: "Enter a valid phone number with 10 to 15 digits" });
    if (!["female", "male", "non_binary", "prefer_not_to_say"].includes(gender)) return res.status(400).json({ error: "Choose a gender option" });
    const user = await UserModel.findOne({ googleId: claims.sub });
    if (!user) return res.status(404).json({ error: "Account not found. Sign in with Google again." });
    if (user.status !== "active") return res.status(403).json({ error: "This account is not active. Contact an administrator." });
    user.firstName = firstName; user.lastName = lastName; user.phoneNumber = phoneNumber; user.gender = gender;
    user.name = `${firstName} ${lastName}`; user.profileComplete = true; user.lastLoginAt = new Date();
    await user.save();
    await recordUserActivity(String(user._id), "Completed profile");
    res.json({ user: { id: user._id, email: user.email, name: user.name, picture: user.picture, firstName: user.firstName, lastName: user.lastName, phoneNumber: user.phoneNumber, gender: user.gender, profileComplete: true, status: user.status } });
  } catch (error) { next(error); }
});

authRouter.get("/user/session", async (req, res, next) => {
  try {
    const authorization = req.header("authorization") ?? "";
    const credential = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const claims = await verifyGoogleCredential(credential);
    if (!claims?.sub) return res.status(401).json({ error: "Google sign-in expired. Sign in again." });
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "User database is unavailable" });
    const user: any = await UserModel.findOne({ googleId: claims.sub }).lean();
    if (!user || user.status !== "active") return res.status(403).json({ error: "This account is inactive or deleted." });
    if (!user.profileComplete) return res.status(409).json({ error: "Complete your profile to continue." });
    res.json({ user: { id: user._id, email: user.email, name: user.name, picture: user.picture, firstName: user.firstName, lastName: user.lastName, phoneNumber: user.phoneNumber, gender: user.gender, profileComplete: true, status: user.status } });
  } catch (error) { next(error); }
});

authRouter.post("/admin/login", async (req, res) => {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!configuredEmail || !configuredPassword || !secret || secret.length < 32) {
    return res.status(503).json({ error: "Admin email/password and a 32-character session secret must be configured" });
  }
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const attempt = failedAdminAttempts.get(ip);
  if (attempt && attempt.blockedUntil > now) return res.status(429).json({ error: "Too many failed attempts. Try again in 15 minutes." });
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!constantTimeEqual(email, configuredEmail) || !constantTimeEqual(password, configuredPassword)) {
    const count = attempt?.blockedUntil && attempt.blockedUntil <= now ? 1 : (attempt?.count ?? 0) + 1;
    failedAdminAttempts.set(ip, { count, blockedUntil: count >= 5 ? now + 15 * 60 * 1000 : 0 });
    return res.status(401).json({ error: "Email or password is incorrect" });
  }
  failedAdminAttempts.delete(ip);
  res.json({ token: createAdminSession(email), admin: { email, name: "Administrator" }, expiresIn: 8 * 60 * 60 });
});

authRouter.get("/admin/session", async (req, res) => {
  const authorization = req.header("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const session = verifyAdminSession(token);
  if (!session) return res.status(401).json({ error: "Admin session expired. Sign in again." });
  res.json({ admin: { email: session.email, name: "Administrator" }, expiresAt: session.exp });
});
