import { scrypt, timingSafeEqual } from "node:crypto";

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = await new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))),
  );
  return timingSafeEqual(derived, Buffer.from(hash, "hex"));
}
