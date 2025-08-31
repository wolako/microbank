import { UserProfile } from '../../shared/models/dashboard.model';

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: UserProfile;
}
