import type { ConfidenceLevel } from "@/types/insights";

export type DataSourceCategory =
  | "network"
  | "dms"
  | "group_chats"
  | "activity"
  | "ads"
  | "security"
  | "search"
  | "inferred";

export interface DataSourceMeta {
  sourceFiles?: string[];
  sourceCategory: DataSourceCategory;
  confidence: ConfidenceLevel;
  includesDirectDMs: boolean;
  includesGroupChats: boolean;
  estimated: boolean;
  explanation: string;
}
