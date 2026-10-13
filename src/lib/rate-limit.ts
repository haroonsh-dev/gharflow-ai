import { rows } from "./db";
import { tokenHash } from "./tokens";
export async function allowed(
  key: string,
  limit: number,
  seconds: number,
): Promise<boolean> {
  const result = await rows<{ count: number }>(
    `INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+$2*interval '1 second')
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<=now() THEN 1 ELSE rate_limits.count+1 END,
    expires_at=CASE WHEN rate_limits.expires_at<=now() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END RETURNING count`,
    [tokenHash(key), seconds],
  );
  return result[0].count <= limit;
}
export async function authAllowed(email: string, action: string) {
  // Account and global limits do not trust arbitrary forwarded IP headers.
  return (
    (await allowed(`auth:${action}:global`, 200, 900)) &&
    (await allowed(`auth:${action}:${email}`, 10, 900))
  );
}
