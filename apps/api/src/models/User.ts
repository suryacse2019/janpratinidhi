import mongoose, { Schema } from "mongoose";

const userSchema = new Schema({
  googleId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  name: { type: String, required: true },
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  phoneNumber: { type: String, trim: true },
  gender: { type: String, enum: ["female", "male", "non_binary", "prefer_not_to_say"] },
  picture: String,
  profileComplete: { type: Boolean, default: false },
  status: { type: String, enum: ["active", "inactive", "deleted"], default: "active", index: true },
  deletedAt: Date,
  lastLoginAt: { type: Date, required: true },
}, { timestamps: true });

export const UserModel = mongoose.models.User || mongoose.model("User", userSchema);
