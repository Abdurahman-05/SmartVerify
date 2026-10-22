import { createInterface } from 'node:readline/promises';

import { loadEnv } from '../config/env.js';
import { hashPassword } from '../modules/admin/admin-auth.js';
import { createPrismaClient } from '../plugins/prisma.js';

/**
 * Sets a new password for an admin (run on the server, so only someone with server access can):
 *   npm run admin:reset-password -- you@example.com
 * Also unlocks the account and signs out its sessions. Two-step stays as it is.
 */
async function main() {
  const [email] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: npm run admin:reset-password -- <email>');
    process.exit(1);
  }
  const prisma = createPrismaClient(loadEnv().DATABASE_URL);
  try {
    const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin) {
      const all = await prisma.adminUser.findMany({ select: { email: true } });
      console.error(`No admin with that email. Admins: ${all.map((a) => a.email).join(', ') || 'none'}`);
      process.exit(1);
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const password = await rl.question('New password (at least 12 characters): ');
    rl.close();
    if (password.length < 12) {
      console.error('Too short: use at least 12 characters.');
      process.exit(1);
    }
    await prisma.$transaction([
      prisma.adminUser.update({
        where: { id: admin.id },
        data: { passwordHash: await hashPassword(password), failedSignIns: 0, lockedUntil: null },
      }),
      prisma.adminSession.updateMany({
        where: { adminId: admin.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    process.stdout.write(`New password set for ${admin.email}.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
