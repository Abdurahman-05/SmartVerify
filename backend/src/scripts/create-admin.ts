import { createInterface } from 'node:readline/promises';

import { loadEnv } from '../config/env.js';
import { hashPassword } from '../modules/admin/admin-auth.js';
import { createPrismaClient } from '../plugins/prisma.js';

/**
 * Creates a Smart Verify admin (there is no sign-up for admins):
 *   npm run admin:create -- you@example.com "Your Name"
 * The password is asked here and only its hash is saved. Two-step is set up at first sign-in.
 */
async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name || name.trim().length < 2) {
    console.error('Usage: npm run admin:create -- <email> "<name>"');
    process.exit(1);
  }
  const env = loadEnv();
  if (!env.ADMIN_SECRET_KEY) {
    console.error('Set ADMIN_SECRET_KEY in .env first (32 random bytes, base64).');
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question('Password (at least 12 characters): ');
  rl.close();
  if (password.length < 12) {
    console.error('Too short: use at least 12 characters.');
    process.exit(1);
  }

  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    await prisma.adminUser.create({
      data: {
        email: email.toLowerCase(),
        name: name.trim(),
        passwordHash: await hashPassword(password),
      },
    });
    process.stdout.write(`Admin ${email.toLowerCase()} created. Sign in to set up two-step.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
