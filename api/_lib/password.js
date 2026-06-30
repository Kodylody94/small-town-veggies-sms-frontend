import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { ApiError } from './errors.js';

const KEY_LENGTH = 64;
const DEFAULT_COST = 16_384;
const DEFAULT_BLOCK_SIZE = 8;
const DEFAULT_PARALLELIZATION = 1;

function derive(password, salt, cost, blockSize, parallelization) {
  return scryptSync(password, salt, KEY_LENGTH, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 64 * 1024 * 1024,
  });
}

export function createPasswordHash(password) {
  const normalized = String(password ?? '');
  if (normalized.length < 12) {
    throw new ApiError(422, 'WEAK_ADMIN_PASSWORD', 'The administrator password must be at least 12 characters.');
  }

  const salt = randomBytes(16);
  const digest = derive(
    normalized,
    salt,
    DEFAULT_COST,
    DEFAULT_BLOCK_SIZE,
    DEFAULT_PARALLELIZATION,
  );

  return [
    'scrypt',
    DEFAULT_COST,
    DEFAULT_BLOCK_SIZE,
    DEFAULT_PARALLELIZATION,
    salt.toString('base64url'),
    digest.toString('base64url'),
  ].join('$');
}

export function verifyPassword(password, encodedHash) {
  const [algorithm, costText, blockSizeText, parallelizationText, saltText, digestText] =
    String(encodedHash ?? '').split('$');

  if (algorithm !== 'scrypt' || !saltText || !digestText) return false;

  const cost = Number(costText);
  const blockSize = Number(blockSizeText);
  const parallelization = Number(parallelizationText);
  if (![cost, blockSize, parallelization].every(Number.isInteger)) return false;

  try {
    const expected = Buffer.from(digestText, 'base64url');
    const actual = derive(String(password ?? ''), Buffer.from(saltText, 'base64url'), cost, blockSize, parallelization);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
