export type OfficeType = "Lok Sabha MP" | "Rajya Sabha MP" | "MLA" | "MLC";
export type SourceType = "ECI" | "Parliament" | "State Legislature" | "Other";

export interface SourceRecord {
  id: string;
  title: string;
  url: string;
  publisher: string;
  sourceType: SourceType;
  accessedAt: string;
}

export interface ElectionRecord {
  year: number;
  electionType: string;
  constituency: string;
  state: string;
  party: string;
  votes: number;
  result: "Won" | "Lost";
  margin?: number;
  source: SourceRecord;
}

export interface Representative {
  id: string;
  name: string;
  slug?: string;
  initials: string;
  party: string;
  partyShort: string;
  office: OfficeType;
  state: string;
  constituency: string;
  photoUrl?: string;
  partySymbolUrl?: string;
  house?: string;
  description?: string;
  termStart?: string;
  termEnd?: string;
  electionYear?: number;
  recordData?: Record<string, unknown>;
  since: string;
  education: string;
  summary: string;
  elections: ElectionRecord[];
  sources: SourceRecord[];
  sample?: boolean;
  updatedAt?: string;
}
