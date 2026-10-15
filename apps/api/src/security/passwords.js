import { promisify } from "node:util";
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";

const scrypt = promisify(nodeScrypt);
const saltBytes = 16;
const keyBytes = 64;

export async function hashPassword(password) {
  const salt = randomBytes(saltBytes);
  const derivedKey = await scrypt(password, salt, keyBytes, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, n, r, p, saltText, keyText] = encoded.split("$");
  if (algorithm !== "scrypt" || n !== "16384" || r !== "8" || p !== "1") return false;

  let salt;
  let expected;
  try {
    salt = Buffer.from(saltText, "base64url");
    expected = Buffer.from(keyText, "base64url");
  } catch {
    return false;
  }
  if (salt.length !== saltBytes || expected.length !== keyBytes) return false;

  const actual = await scrypt(password, salt, keyBytes, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(actual, expected);
}
