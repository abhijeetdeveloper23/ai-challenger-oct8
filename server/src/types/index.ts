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
  analyzedAt?: Date;
}

export interface ScoreBreakdown {
  businessActivity: number;
  contactability: number;
  digitalOpportunity: number;
  conversionOpportunity: number;
}

export interface BusinessCandidate {
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
}

export interface ScoredLeadResult {
  leadScore: number;
  scoreBreakdown: ScoreBreakdown;
  scoreReasons: string[];
  opportunities: string[];
  primaryOpportunity: string;
}

export type PriorityLevel = "HOT" | "HIGH" | "MEDIUM" | "LOW";

export interface LeadPriority {
  level: PriorityLevel;
  label: string;
}
