import { PrismaClient } from "@prisma/client";

declare global {
	var __broadyPrisma: PrismaClient | undefined;
}

const createPrismaClient = () =>
	new PrismaClient({
		log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
	});

export const prisma = globalThis.__broadyPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalThis.__broadyPrisma = prisma;
}
