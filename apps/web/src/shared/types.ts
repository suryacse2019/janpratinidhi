import type { Representative } from "@janpratinidhi/shared";

export type Profile = Representative;
export type Gender = "female" | "male" | "non_binary" | "prefer_not_to_say";
export type User = { id: string; email: string; name: string; picture?: string; firstName?: string; lastName?: string; phoneNumber?: string; gender?: Gender; profileComplete?: boolean; status?: "active" | "inactive" | "deleted" };
export type AdminUser = { _id: string; email: string; name: string; picture?: string; firstName?: string; lastName?: string; phoneNumber?: string; gender?: Gender; profileComplete?: boolean; status?: "active" | "inactive" | "deleted"; createdAt: string; lastLoginAt: string; lastActivity?: { action: string; details: string; at: string } | null };
export type AdminRepresentative = Profile & { _id: string; status: "draft" | "published" };
export type AdminActivity = { _id: string; action: string; details: string; createdAt: string; lastSeenAt?: string; userId?: { _id?: string; name?: string; email?: string } | string | null };
export type AdminStats = { users: number; representatives: number; published: number; drafts: number; todayVisitors: number; dailyVisitors: Array<{ date: string; count: number }> };
export type GoogleCredential = { credential: string };
