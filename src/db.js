const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'up';
  } catch (error) {
    return 'down';
  }
}

module.exports = { prisma, checkDatabase };
