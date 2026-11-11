export interface GeoArea {
  id: string;
  name: string;
  county_name?: string | null;
  display_name?: string | null;
  state_code?: string | null;
  state_fips?: string | number | null;
  county_fips?: string | number | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export interface AgentRecord {
  id: string;
  name: string;
  brokerage?: string | null;
  email?: string | null;
  phone?: string | null;
  service_area?: string | null;
  service_areas?: string[] | null;
  city?: string | null;
  state?: string | null;
  zip_codes?: string[] | null;
  specialty?: string | null;
  active: boolean;
  __matchType?: "assignment" | "service_text";
  __distanceMiles?: number | null;
  __distanceSource?: "verified_address" | null;
  __distanceLabel?: string | null;
}

export type NoticeTone = "info" | "good" | "warn";