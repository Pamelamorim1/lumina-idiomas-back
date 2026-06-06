// Caminho: backend/src/config/init-db.js

const db = require('./database'); // Prisma client
const bcrypt = require('bcryptjs');

async function initDb() {
  try {
    // 1. Verify connection using Prisma raw query
    await db.$queryRaw`SELECT 1`;
    console.log('[Database] Connected successfully to PostgreSQL via Prisma.');

    // 2. Seed default user if database/table 'usuario' is empty
    const count = await db.usuario.count();
    if (count === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);
      
      await db.usuario.create({
        data: {
          nome_completo: 'Estudante Lumina',
          email: 'teste@lumina.com',
          senha_hash: hashedPassword,
        }
      });
      console.log('[Database] Seed: Default user created successfully (teste@lumina.com / password123).');
    }
  } catch (error) {
    // If table doesn't exist or connection failed, log a helpful error message
    console.error('[Database] Connection or Initialization error:', error.message);
    if (error.message.includes('relation "usuario" does not exist') || error.code === 'P2021') {
      console.warn('\n⚠️ [Database Warning] The "usuario" table was not found in the database.');
      console.warn('👉 Please run "npx prisma db push" to synchronize your PostgreSQL schema.\n');
    }
    throw error;
  }
}

module.exports = initDb;
