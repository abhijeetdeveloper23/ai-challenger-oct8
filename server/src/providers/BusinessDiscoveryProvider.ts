import type { BusinessCandidate } from "../types/index.js";

export interface BusinessDiscoveryProvider {
  searchBusinesses(query: string, location: string): Promise<BusinessCandidate[]>;
  readonly name: string;
}
