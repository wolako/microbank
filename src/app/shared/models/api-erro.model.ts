export interface ApiError {
  error: {
    message: string;
    code?: number;
    details?: Record<string, unknown>;
  };
  status?: number;
  statusText?: string;
}