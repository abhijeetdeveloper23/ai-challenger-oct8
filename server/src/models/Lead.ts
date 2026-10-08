import mongoose, { Schema, Document } from "mongoose";
import type { Address, ScoreBreakdown, WebsiteAnalysis } from "../types/index.js";
import {
  normalizeBusinessName,
  normalizePhone,
  normalizeWebsite,
  normalizeAddress,
} from "../utils/normalize.js";

export interface ILead extends Document {
  name: string;
  normalizedName?: string;
  category?: string;
  address?: Address;
  normalizedAddress?: string;
  phone?: string;
  normalizedPhone?: string;
  email?: string;
  website?: string;
  normalizedWebsite?: string;
  rating?: number;
  reviewCount?: number;
  source?: string;
  sourceId?: string;
  websiteAnalysis?: WebsiteAnalysis;
  opportunities: string[];
  primaryOpportunity?: string;
  leadScore: number;
  scoreBreakdown: ScoreBreakdown;
  scoreReasons: string[];
  estimatedRevenue?: {
    label: string;
    midpoint: number;
    confidence: "low" | "medium" | "high";
    basis: string;
  };
  ownerDetails?: {
    ownerName?: string;
    ownerTitle?: string;
    ownerLinkedIn?: string;
    companyLinkedIn?: string;
    parentCompany?: string;
    affiliatedCompanies?: string[];
    ownershipType?: string;
    confidence: "low" | "medium" | "high";
    sources: string[];
    notes?: string;
    enrichedAt?: Date;
  };
  companyEnrichment?: {
    emails: string[];
    phones: string[];
    socialLinks: {
      facebook?: string;
      instagram?: string;
      linkedin?: string;
      twitter?: string;
      youtube?: string;
    };
    pageTitle?: string;
    pageDescription?: string;
    hasBooking: boolean;
    hasContactForm: boolean;
    hasSocialLinks: boolean;
    websiteReachable: boolean;
    aiProfile?: string;
    sources: string[];
    enrichedAt?: Date;
  };
  aiBrief?: {
    businessSummary: string;
    whyUseful: string;
    approachSteps: string[];
    talkingPoints: string[];
    pitchAngle: string;
    generatedAt?: Date;
    model?: string;
  };
  searchId?: mongoose.Types.ObjectId;
  isDemo?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema(
  {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
  },
  { _id: false }
);

const WebsiteAnalysisSchema = new Schema(
  {
    exists: { type: Boolean, default: false },
    reachable: { type: Boolean, default: false },
    statusCode: Number,
    https: Boolean,
    hasEmail: Boolean,
    hasPhone: Boolean,
    hasBooking: Boolean,
    hasContactForm: Boolean,
    hasSocialLinks: Boolean,
    hasViewport: Boolean,
    title: String,
    description: String,
    analyzedAt: Date,
  },
  { _id: false }
);

const ScoreBreakdownSchema = new Schema(
  {
    businessActivity: { type: Number, default: 0 },
    contactability: { type: Number, default: 0 },
    digitalOpportunity: { type: Number, default: 0 },
    conversionOpportunity: { type: Number, default: 0 },
  },
  { _id: false }
);

const LeadSchema = new Schema<ILead>(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, index: true },
    category: { type: String, index: true },
    address: AddressSchema,
    normalizedAddress: String,
    phone: String,
    normalizedPhone: { type: String, index: true },
    email: String,
    website: String,
    normalizedWebsite: { type: String, index: true },
    rating: { type: Number, min: 0, max: 5 },
    reviewCount: { type: Number, min: 0, default: 0 },
    source: String,
    sourceId: String,
    websiteAnalysis: WebsiteAnalysisSchema,
    opportunities: { type: [String], default: [] },
    primaryOpportunity: String,
    leadScore: { type: Number, required: true, min: 0, max: 100, index: true },
    scoreBreakdown: { type: ScoreBreakdownSchema, required: true },
    scoreReasons: { type: [String], default: [] },
    estimatedRevenue: {
      label: String,
      midpoint: Number,
      confidence: { type: String, enum: ["low", "medium", "high"] },
      basis: String,
    },
    ownerDetails: {
      ownerName: String,
      ownerTitle: String,
      ownerLinkedIn: String,
      companyLinkedIn: String,
      parentCompany: String,
      affiliatedCompanies: [String],
      ownershipType: String,
      confidence: { type: String, enum: ["low", "medium", "high"] },
      sources: [String],
      notes: String,
      enrichedAt: Date,
    },
    companyEnrichment: {
      emails: [String],
      phones: [String],
      socialLinks: {
        facebook: String,
        instagram: String,
        linkedin: String,
        twitter: String,
        youtube: String,
      },
      pageTitle: String,
      pageDescription: String,
      hasBooking: Boolean,
      hasContactForm: Boolean,
      hasSocialLinks: Boolean,
      websiteReachable: Boolean,
      aiProfile: String,
      sources: [String],
      enrichedAt: Date,
    },
    aiBrief: {
      businessSummary: String,
      whyUseful: String,
      approachSteps: [String],
      talkingPoints: [String],
      pitchAngle: String,
      generatedAt: Date,
      model: String,
    },
    searchId: { type: Schema.Types.ObjectId, ref: "Search", index: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

LeadSchema.index({ source: 1, sourceId: 1 });
LeadSchema.index({ "address.city": 1 });
LeadSchema.index({ normalizedName: 1, normalizedAddress: 1 });
LeadSchema.index({ leadScore: -1, createdAt: -1 });
LeadSchema.index({ opportunities: 1 });

LeadSchema.pre("save", function (next) {
  this.normalizedName = normalizeBusinessName(this.name);
  this.normalizedPhone = normalizePhone(this.phone);
  this.normalizedWebsite = normalizeWebsite(this.website);
  this.normalizedAddress = normalizeAddress(this.address);
  next();
});

export const Lead = mongoose.model<ILead>("Lead", LeadSchema);
