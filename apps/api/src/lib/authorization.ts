import type { Env } from "../env";
import { ApiError } from "./http";
import { userRest } from "./supabase";

export type MatterRole = "matter_manager" | "editor" | "reviewer" | "viewer";
const RANK: Record<MatterRole, number> = { viewer: 1, reviewer: 2, editor: 3, matter_manager: 4 };

export async function requireMatterRole(env: Env, accessToken: string, userId: string, matterId: string, minimum: MatterRole) {
  const rows = await userRest(env, accessToken, `/matter_memberships?matter_id=eq.${encodeURIComponent(matterId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=role&limit=1`);
  const role = rows?.[0]?.role as MatterRole | undefined;
  if (!role || RANK[role] < RANK[minimum]) throw new ApiError(403, "Matter access denied", "forbidden");
  return role;
}
