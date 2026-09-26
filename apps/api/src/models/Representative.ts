import mongoose, { Schema } from "mongoose";

const sourceSchema = new Schema({
  title: { type: String, required: true }, url: { type: String, required: true },
  publisher: { type: String, required: true }, sourceType: { type: String, required: true },
  accessedAt: { type: Date, required: true },
}, { _id: false });

const electionSchema = new Schema({
  year: { type: Number, required: true }, electionType: { type: String, required: true },
  constituency: { type: String, required: true }, state: { type: String, required: true },
  party: { type: String, required: true }, votes: { type: Number, required: true },
  result: { type: String, enum: ["Won", "Lost"], required: true }, margin: Number,
  source: { type: sourceSchema, required: true },
}, { _id: false });

const representativeSchema = new Schema({
  name: { type: String, required: true, index: true }, slug: { type: String, trim: true, index: true }, initials: String,
  party: { type: String, required: true, index: true }, partyShort: String,
  office: { type: String, enum: ["Lok Sabha MP", "Rajya Sabha MP", "MLA", "MLC"], required: true, index: true },
  state: { type: String, required: true, index: true }, constituency: { type: String, index: true },
  photoUrl: String, partySymbolUrl: String, house: String, description: String,
  termStart: String, termEnd: String, electionYear: Number, recordData: Schema.Types.Mixed,
  since: String, education: String, summary: String,
  elections: [electionSchema], sources: [sourceSchema],
  status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
  sample: { type: Boolean, default: false },
}, { timestamps: true });

representativeSchema.index({ status: 1, state: 1, office: 1 });
representativeSchema.index({ status: 1, party: 1, state: 1 });
representativeSchema.index({ status: 1, constituency: 1 });
export const RepresentativeModel = mongoose.models.Representative || mongoose.model("Representative", representativeSchema);
