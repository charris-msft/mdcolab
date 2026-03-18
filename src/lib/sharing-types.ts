export interface SharingDocument {
  mode: "specific_people" | "anyone_with_link";
  users?: string[];
  allowEditing?: boolean;
  sharedBy: string;
  sharedAt: string;
  expiresAt?: string;
}

export interface SharingConfig {
  version: number;
  defaultMode?: string;
  documents: Record<string, SharingDocument>;
}
