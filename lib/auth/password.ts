import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, stored] = passwordHash.split(":");

  if (!salt || !stored) {
    return false;
  }

  const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return timingSafeEqual(Buffer.from(stored, "hex"), Buffer.from(derived, "hex"));
}
