import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { representativesRouter } from "./routes/representatives.js";
import { healthRouter } from "./routes/health.js";
import { partiesRouter } from "./routes/parties.js";
import { analyticsRouter } from "./routes/analytics.js";
import { activityRouter } from "./routes/activity.js";
import { syncPartyCatalog } from "./services/partyCatalog.js";

const app = express();
const allowedOrigins = new Set([
  "https://janpratinidhi.vercel.app",
  "http://localhost:5173",
  ...(process.env.CLIENT_ORIGIN ? [process.env.CLIENT_ORIGIN] : []),
]);
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.has(origin)) return callback(null, true);
  callback(new Error("Origin is not allowed by CORS"));
} }));
app.use(express.json({ limit: "1mb" }));

let databaseConnection: Promise<void> | undefined;
const connectToDatabase = async () => {
  if (!process.env.MONGODB_URI || mongoose.connection.readyState === 1) return;
  databaseConnection ??= mongoose.connect(process.env.MONGODB_URI)
    .then(() => syncPartyCatalog())
    .catch((error) => {
      databaseConnection = undefined;
      throw error;
    });
  await databaseConnection;
};

// Vercel invokes this Express app as a serverless function. Connect lazily so
// health checks can still respond if the database is temporarily unavailable.
app.use(async (req, res, next) => {
  if (req.path === "/api/health" || req.path === "/api/health/") return next();
  if (!process.env.MONGODB_URI) return next();
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error("Could not connect to MongoDB", error);
    res.status(503).json({ error: "Database is unavailable" });
  }
});

app.use("/api/health", healthRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/activity", activityRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/representatives", representativesRouter);
app.use("/api/parties", partiesRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong" });
});

export default app;

// Keep the persistent listener for local development. Vercel imports the
// exported app and manages the request listener itself.
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 4000);
  connectToDatabase()
    .then(() => app.listen(port, () => console.log(`Janpratinidhi API listening on http://localhost:${port}`)))
    .catch((error) => { console.error("Could not start API", error); process.exit(1); });
  if (!process.env.MONGODB_URI) console.warn("MONGODB_URI is not set; database-backed routes will be unavailable.");
}
