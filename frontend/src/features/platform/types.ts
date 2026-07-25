/** Platform admin feature types — mirrors app/schemas/platform.py */

export interface TenantRead {
  id: string;
  name: string;
  superuser_email: string | null;
  is_platform: boolean;
  created_at: string;
  user_count: number;
}

export interface PlatformAdminRead {
  id: string;
  email: string;
  username: string | null;
  assigned_at: string | null;
}

export interface TenantCreate {
  name: string;
  superuser_email?: string;
}
