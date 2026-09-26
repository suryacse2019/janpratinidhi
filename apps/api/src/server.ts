import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { representativesRouter } from "./routes/representatives.js";
import { healthRouter } from "./routes/health.js";
import { partiesRouter } from "./routes/parties.js";
import { syncPartyCatalog } from "./services/partyCatalog.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/representatives", representativesRouter);
app.use("/api/parties", partiesRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong" });
});

const port = Number(process.env.PORT ?? 4000);
const start = async () => {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    await syncPartyCatalog();
  }
  else console.warn("MONGODB_URI is not set; database-backed routes will be unavailable.");
  app.listen(port, () => console.log(`Janpratinidhi API listening on http://localhost:${port}`));
};
start().catch((error) => { console.error("Could not start API", error); process.exit(1); });
