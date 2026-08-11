export interface DynamicConfig {
  apiUrl: string;
  memos?: {
    apiUrl?: string;
    userId?: string;
    limit?: number;
  };
}
