import type { MeResponse } from "./api";
import type { MsalAccountProfile } from "./msal";

export interface AuthUser {
  id?: string;
  object_id?: string;
  subject?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  username?: string;
  tenant_id?: string;
  roles?: string[];
  job_title?: string;
  department?: string;
  office_location?: string;
  mobile_phone?: string;
  business_phones?: string[];
  photo_url?: string;
  identity_provider?: string;
  auth_provider?: string;
  token_version?: string;
  issued_at?: number;
  expires_at?: number;
}

export function mergeUserProfile(
  apiUser?: AuthUser | null,
  msal?: MsalAccountProfile | null,
): AuthUser | null {
  if (!apiUser && !msal) return null;

  const roles = [
    ...new Set([...(apiUser?.roles ?? []), ...(msal?.roles ?? [])]),
  ];

  const name =
    apiUser?.name ||
    msal?.name ||
    [apiUser?.given_name ?? msal?.givenName, apiUser?.family_name ?? msal?.familyName]
      .filter(Boolean)
      .join(" ") ||
    undefined;

  return {
    ...apiUser,
    id: apiUser?.id ?? apiUser?.object_id ?? msal?.objectId,
    object_id: apiUser?.object_id ?? msal?.objectId,
    name,
    given_name: apiUser?.given_name ?? msal?.givenName,
    family_name: apiUser?.family_name ?? msal?.familyName,
    email: apiUser?.email ?? msal?.email ?? msal?.username,
    username: apiUser?.username ?? msal?.username ?? msal?.email,
    tenant_id: apiUser?.tenant_id ?? msal?.tenantId,
    roles: roles.length ? roles : undefined,
    job_title: apiUser?.job_title ?? msal?.jobTitle,
    department: apiUser?.department ?? msal?.department,
    office_location: apiUser?.office_location ?? msal?.officeLocation,
    mobile_phone: apiUser?.mobile_phone ?? msal?.mobilePhone,
    business_phones: apiUser?.business_phones ?? msal?.businessPhones,
    photo_url: apiUser?.photo_url ?? msal?.photoUrl,
  };
}

export function userDisplayName(user?: AuthUser | null): string {
  if (!user) return "Signed-in user";
  return user.name || user.email || user.username || "Signed-in user";
}

export function userInitials(user?: AuthUser | null): string {
  const name = userDisplayName(user);
  if (user?.email && !user?.name) {
    return user.email.slice(0, 2).toUpperCase();
  }
  return (
    name
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function formatTokenTime(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

export function isMeResponse(v: unknown): v is MeResponse {
  return typeof v === "object" && v !== null && "authenticated" in v;
}
