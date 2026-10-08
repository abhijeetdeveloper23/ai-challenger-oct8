import mongoose, { Schema, Document } from "mongoose";

export interface ISearch extends Document {
  query: string;
  location: string;
  product?: string;
  cacheKey: string;
  resultCount: number;
  durationMs?: number;
  isDemo?: boolean;
  providers?: string[];
  failedProviders?: { name: string; error: string }[];
  leadIds: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const SearchSchema = new Schema<ISearch>(
  {
    query: { type: String, required: true },
    location: { type: String, required: true },
    product: { type: String },
    cacheKey: { type: String, required: true, index: true },
    resultCount: { type: Number, default: 0 },
    durationMs: Number,
    isDemo: { type: Boolean, default: false },
    providers: { type: [String], default: [] },
    failedProviders: {
      type: [
        {
          name: String,
          error: String,
        },
      ],
      default: [],
    },
    leadIds: [{ type: Schema.Types.ObjectId, ref: "Lead" }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SearchSchema.index({ cacheKey: 1, createdAt: -1 });

export const Search = mongoose.model<ISearch>("Search", SearchSchema);
