import mongoose, { type InferSchemaType, type Model } from "mongoose";

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

const existing: unknown = mongoose.models.LineLink;

export const LineLink: Model<LineLinkDoc> = existing
  ? (existing as Model<LineLinkDoc>)
  : mongoose.model("LineLink", lineLinkSchema);
