import { Schema } from "mongoose";

import { defineModel } from "@/lib/db/mongoose";

export type FollowDoc = {
  userId: string;
  showRoute: string;
  createdAt: Date;
};

const followSchema = new Schema<FollowDoc>({
  userId: { type: String, required: true },
  showRoute: { type: String, required: true },
  createdAt: { type: Date, required: true },
});
followSchema.index({ userId: 1, showRoute: 1 }, { unique: true });

export const Follow = defineModel("Follow", followSchema);
