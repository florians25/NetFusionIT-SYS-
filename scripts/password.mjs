import { randomBytes, scrypt as rawScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(rawScrypt);
export async function hashPassword(password) {
  const salt=randomBytes(24).toString('hex');
  const key=await scrypt(password,salt,64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password,hash) {
  const [kind,salt,encoded]=hash.split(':');
  if(kind!=='scrypt'||!salt||!encoded) return false;
  const key=await scrypt(password,salt,64);
  const expected=Buffer.from(encoded,'hex');
  return expected.length===key.length && timingSafeEqual(key,expected);
}
