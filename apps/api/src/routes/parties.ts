import { Router } from "express";
import { PartyModel } from "../models/Party.js";

export const partiesRouter = Router();

partiesRouter.get("/", async (_req, res, next) => {
  try {
    const data = await PartyModel.find({}, { name: 1, shortName: 1 }).sort({ name: 1 }).lean();
    res.json({ data });
  } catch (error) { next(error); }
});
