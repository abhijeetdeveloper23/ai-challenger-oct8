import mongoose, { Schema, Document } from "mongoose";

export type ScrapeJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "partial"
  | "failed";

export interface IScrapeJob extends Document {
  searchId: mongoose.Types.ObjectId;
  status: ScrapeJobStatus;
  totalFound: number;
  totalProcessed: number;
  totalFailed: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ScrapeJobSchema = new Schema<IScrapeJob>(
  {
    searchId: { type: Schema.Types.ObjectId, ref: "Search", required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "partial", "failed"],
      default: "pending",
      index: true,
    },
    totalFound: { type: Number, default: 0 },
    totalProcessed: { type: Number, default: 0 },
    totalFailed: { type: Number, default: 0 },
    startedAt: Date,
    completedAt: Date,
    error: String,
  },
  { timestamps: true }
);

export const ScrapeJob = mongoose.model<IScrapeJob>("ScrapeJob", ScrapeJobSchema);
