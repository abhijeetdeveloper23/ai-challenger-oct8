export type PriorityLevel = "HOT" | "HIGH" | "MEDIUM" | "LOW";

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface WebsiteAnalysis {
  exists: boolean;
  reachable: boolean;
  statusCode?: number;
  https?: boolean;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasBooking?: boolean;
  hasContactForm?: boolean;
  hasSocialLinks?: boolean;
  hasViewport?: boolean;
  title?: string;
  description?: string;
  analyzedAt?: string;
}

export interface ScoreBreakdown {
  businessActivity: number;
  contactability: number;
  digitalOpportunity: number;
  conversionOpportunity: number;
}

export interface EstimatedRevenue {
  label: string;
  midpoint: number;
  confidence: "low" | "medium" | "high";
  basis: string;
}

export interface OwnerDetails {
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
  enrichedAt?: string;
}

export interface CompanyEnrichment {
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
  enrichedAt?: string;
}

export interface AiBrief {
  businessSummary: string;
  whyUseful: string;
  approachSteps: string[];
  talkingPoints: string[];
  pitchAngle: string;
  generatedAt?: string;
  model?: string;
}

export interface Lead {
  _id: string;
  name: string;
  category?: string;
  address?: Address;
  phone?: string;
  email?: string;
  website?: string;
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
  estimatedRevenue?: EstimatedRevenue;
  ownerDetails?: OwnerDetails;
  companyEnrichment?: CompanyEnrichment;
  aiBrief?: AiBrief;
  searchId?: string;
  isDemo?: boolean;
  priority?: PriorityLevel;
  priorityLabel?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadSummary {
  total: number;
  hot: number;
  high: number;
  medium: number;
  low: number;
  opportunities: number;
}

export interface LeadsResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: LeadSummary;
  leads: Lead[];
}

export interface SearchResponse {
  searchId: string;
  count: number;
  cached: boolean;
  isDemo: boolean;
  providers?: string[];
  failedProviders?: { name: string; error: string }[];
  sourceCounts?: Record<string, number>;
  product?: string | null;
  job: {
    status: string;
    totalFound: number;
    processed: number;
    failed: number;
    durationMs: number;
  };
  leads: Lead[];
}

export interface LeadFilters {
  page?: number;
  limit?: number;
  minScore?: number;
  maxScore?: number;
  priority?: string;
  city?: string;
  category?: string;
  hasWebsite?: boolean;
  hasPhone?: boolean;
  hasEmail?: boolean;
  opportunity?: string;
  searchId?: string;
  q?: string;
  sort?: string;
}
