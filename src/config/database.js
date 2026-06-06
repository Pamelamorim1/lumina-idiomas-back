// Caminho: backend/src/config/database.js

const { PrismaClient } = require('../generated/prisma');

// Initialize Prisma Client with query logging in development mode
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

module.exports = prisma;
