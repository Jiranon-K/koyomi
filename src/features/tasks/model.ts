import mongoose, { type InferSchemaType, type Model } from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    done: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type TaskDoc = InferSchemaType<typeof taskSchema> & { _id: mongoose.Types.ObjectId };

export const Task: Model<InferSchemaType<typeof taskSchema>> =
  mongoose.models.Task ?? mongoose.model("Task", taskSchema);
