export interface SharingDocument {
  mode: "specific_people" | "anyone_with_link";
  users?: string[];
  sharedBy: string;
  sharedAt: string;
}

export interface SharingConfig {
  version: number;
  defaultMode?: string;
  documents: Record<string, SharingDocument>;
}
