import mongoose, { Schema } from "mongoose";

const siteVisitSchema = new Schema(
  {
    _id: { type: String },
    day: { type: String, required: true },
    visitorHash: { type: String, required: true },
  },
  { timestamps: true },
);

siteVisitSchema.index({ day: 1 });
siteVisitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const SiteVisitModel =
  mongoose.models.SiteVisit || mongoose.model("SiteVisit", siteVisitSchema);
