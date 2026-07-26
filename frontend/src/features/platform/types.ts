/** Platform admin feature types — mirrors app/schemas/platform.py */

export interface TenantRead {
  id: string;
  name: string;
  admin_email: string | null;
  is_platform: boolean;
  created_at: string;
  user_count: number;
  warehouse_count: number;
  admin_user_id: string | null;
}

/**
 * The account created alongside a tenant or platform admin.
 * `temporary_password` is only present when this request created the account —
 * it is shown once and then forced to change at first login.
 */
export interface ProvisionedAdminRead {
  user_id: string;
  email: string;
  username: string | null;
  created: boolean;
  temporary_password: string | null;
}

export interface TenantWithAdminRead {
  tenant: TenantRead;
  admin: ProvisionedAdminRead | null;
}

export interface TenantCreate {
  name: string;
  admin_email: string;
}

export interface TenantUpdate {
  name?: string;
  admin_email?: string;
}

export interface PlatformAdminRead {
  id: string;
  email: string;
  username: string | null;
  assigned_at: string | null;
}

/** Create by email (provisions an account) or promote an existing user by id. */
export interface PlatformAdminCreate {
  email?: string;
  username?: string;
  user_id?: string;
}

export interface PlatformAdminUpdate {
  email?: string;
  username?: string;
}

export interface PlatformAdminWithCredentialRead {
  admin: PlatformAdminRead;
  created: boolean;
  temporary_password: string | null;
}

export interface PasswordResetRead {
  user_id: string;
  email: string;
  temporary_password: string;
}
