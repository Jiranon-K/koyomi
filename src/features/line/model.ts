import mongoose, { type InferSchemaType } from "mongoose";

import { defineModel } from "@/lib/db/mongoose";

const lineLinkSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    lineUserId: { type: String, required: true },
    friend: { type: Boolean, required: true, default: false },
    friendEventAt: { type: Date, default: null },
    reminderSlot: { type: Number, default: null },
  },
  { timestamps: true, autoIndex: false },
);

lineLinkSchema.index({ userId: 1 }, { unique: true });
lineLinkSchema.index({ lineUserId: 1 }, { unique: true });
lineLinkSchema.index(
  { reminderSlot: 1 },
  { unique: true, partialFilterExpression: { reminderSlot: { $type: "number" } } },
);

export type LineLinkDoc = InferSchemaType<typeof lineLinkSchema>;

export const LineLink = defineModel<LineLinkDoc>("LineLink", lineLinkSchema);
