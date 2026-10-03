import mongoose, { type InferSchemaType, type Model } from "mongoose";

/**
 * One row per app user who has linked LINE. The link itself belongs to Better Auth (an `account`
 * row for the LINE provider); this row is the app's copy of the LINE user id plus what only the
 * app knows: whether the user is a friend of the bot, and whether reminders are switched on.
 */
const lineLinkSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    lineUserId: { type: String, required: true },
    friend: { type: Boolean, required: true, default: false },
    // When the last `follow`/`unfollow` webhook event that was applied happened, so that a late
    // redelivery of an older event cannot undo a newer one.
    friendEventAt: { type: Date, default: null },
    // Reminders are switched on while the user holds one of the numbered slots (1 to the cap).
    reminderSlot: { type: Number, default: null },
  },
  // Indexes are created by the service once the connection is up (`bufferCommands` is off).
  { timestamps: true, autoIndex: false },
);

lineLinkSchema.index({ userId: 1 }, { unique: true });
lineLinkSchema.index({ lineUserId: 1 }, { unique: true });
// The cap on reminder users: a slot number can be held by one user only.
lineLinkSchema.index(
  { reminderSlot: 1 },
  { unique: true, partialFilterExpression: { reminderSlot: { $type: "number" } } },
);

export type LineLinkDoc = InferSchemaType<typeof lineLinkSchema>;

const existing: unknown = mongoose.models.LineLink;

export const LineLink: Model<LineLinkDoc> = existing
  ? (existing as Model<LineLinkDoc>)
  : mongoose.model("LineLink", lineLinkSchema);
