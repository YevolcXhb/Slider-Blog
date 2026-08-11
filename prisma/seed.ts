import { scryptSync, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import mariadb from 'mariadb';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const pool = mariadb.createPool(connectionString);
const adapter = new PrismaMariaDb(pool);

const prisma = new PrismaClient({ adapter });

const defaultPassword = process.env.SEED_ADMIN_PASSWORD;

if (!defaultPassword) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SEED_ADMIN_PASSWORD must be set explicitly when running seed in production. ' +
        'Refusing to use a default password in production.'
    );
  }
  // Dev/test convenience default — printed to console so the developer can
  // see it immediately. NEVER rely on this in production.
  console.warn(
    '[seed] SEED_ADMIN_PASSWORD not set — using dev-only default "admin123456". ' +
      'Set SEED_ADMIN_PASSWORD explicitly for any non-local environment.'
  );
}

const effectivePassword = defaultPassword || 'admin123456';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const adminEmail = 'admin@example.com';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        username: 'admin',
        email: adminEmail,
        password_hash: hashPassword(effectivePassword),
        role: 1, // Admin
      }
    });
    console.log('Admin user created');
    console.log('Default admin password:', effectivePassword);
  } else {
    console.log('Admin user already exists');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });