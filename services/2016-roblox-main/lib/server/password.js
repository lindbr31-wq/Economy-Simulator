// Argon2id password hashing in libsodium's crypto_pwhash_str (PHC) format, so
// hashes are interchangeable with the .NET backend's PasswordHasher
// (Roblox.Libraries/Password/PasswordHasher.cs -> Sodium PasswordHash.ArgonHashString).
// Uses hash-wasm (pure WASM) so there are no native build steps on Vercel.
import { argon2id, argon2Verify } from 'hash-wasm';
import crypto from 'crypto';

// Same defaults libsodium uses for crypto_pwhash_str (moderate ops limit):
// m=32768 KiB, t=3, p=1, 32-byte output, 16-byte salt.
const PARAMS = {
  memorySize: 32768, // KiB
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
};

const b64 = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '');

export const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16);
  const hashHex = await argon2id({
    password,
    salt,
    ...PARAMS,
    outputType: 'hex',
  });
  const hash = Buffer.from(hashHex, 'hex');
  return `$argon2id$v=19$m=${PARAMS.memorySize},t=${PARAMS.iterations},p=${PARAMS.parallelism}$${b64(salt)}$${b64(hash)}`;
};

export const verifyPassword = async (hash, password) => {
  if (typeof hash !== 'string' || !hash.startsWith('$argon2')) return false;
  try {
    return await argon2Verify({ password, hash });
  } catch (e) {
    return false;
  }
};
