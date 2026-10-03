import mongoose, { Schema, type Model } from "mongoose";

export type FollowDoc = {
  /** The Better Auth user id. */
  userId: string;
  /** The followed show's `route`, the key the schedule uses. */
  showRoute: string;
  createdAt: Date;
};

const followSchema = new Schema<FollowDoc>({
  userId: { type: String, required: true },
  showRoute: { type: String, required: true },
  createdAt: { type: Date, required: true },
});
// One follow per user and show; also serves "all follows of a user".
followSchema.index({ userId: 1, showRoute: 1 }, { unique: true });

const existing = mongoose.models.Follow as Model<FollowDoc> | undefined;

export const Follow = existing ?? mongoose.model<FollowDoc>("Follow", followSchema);
