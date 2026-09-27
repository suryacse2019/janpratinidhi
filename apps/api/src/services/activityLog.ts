import { ActivityEventModel } from "../models/ActivityEvent.js";

export async function recordUserActivity(userId: string, action: string, details = ""): Promise<void> {
  try {
    const cleanDetails = details.slice(0, 240);
    const lastSeenAt = new Date();
    if (action === "Viewed page") {
      const pageKey = `${userId}:${cleanDetails}`;
      try {
        await ActivityEventModel.updateOne(
          { pageKey },
          { $set: { lastSeenAt }, $setOnInsert: { userId, action, details: cleanDetails, pageKey } },
          { upsert: true },
        );
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
        await ActivityEventModel.updateOne({ pageKey }, { $set: { lastSeenAt } });
      }
      return;
    }
    await ActivityEventModel.create({ userId, action, details: cleanDetails, lastSeenAt });
  } catch (error) {
    // Activity logging must never prevent the requested user action from working.
    console.error("Could not record user activity", error);
  }
}
