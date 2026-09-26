import mongoose, { Schema } from "mongoose";

const partySchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true, index: true },
  shortName: { type: String, trim: true },
}, { timestamps: true });

export const PartyModel = mongoose.models.Party || mongoose.model("Party", partySchema);
