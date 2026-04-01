import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client
let prisma;

// Configure Prisma Client
const clientConfig = {
    log: process.env.NODE_ENV !== 'production' ? ['query', 'info', 'warn', 'error'] : ['error'],
};

if (process.env.NODE_ENV === 'production') {
    prisma = new PrismaClient(clientConfig);
} else {
    // Prevent multiple instances during development (hot reload)
    if (!global.prisma) {
        global.prisma = new PrismaClient(clientConfig);
    }
    prisma = global.prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

export default prisma;
