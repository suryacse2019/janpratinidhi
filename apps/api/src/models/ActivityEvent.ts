import mongoose, { Schema } from "mongoose";

const activityEventSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  action: { type: String, required: true },
  details: { type: String, default: "", maxlength: 240 },
  pageKey: { type: String },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });

activityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
activityEventSchema.index({ userId: 1, createdAt: -1 });
activityEventSchema.index({ pageKey: 1 }, { unique: true, sparse: true });

export const ActivityEventModel = mongoose.models.ActivityEvent || mongoose.model("ActivityEvent", activityEventSchema);
