import { createPasswordHash } from '../api/_lib/password.js';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/generate-admin-password-hash.mjs "a-long-unique-password"');
  process.exitCode = 1;
} else {
  console.log(createPasswordHash(password));
}
