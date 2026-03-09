import { createHash } from "crypto";

export type PlatformSessionItem = {
  id: string;
  current: boolean;
  createdAt: string;
  lastActiveAt?: string;
};

export function platformSessionIdFromAccessToken(accessToken: string): string {
  return createHash("sha256").update(accessToken).digest("hex").slice(0, 24);
}
