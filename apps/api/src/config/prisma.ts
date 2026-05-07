import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

declare global {
	var __broadyPrisma: PrismaClient | undefined;
}

function buildDatabaseUrl(url: string) {
	const parsed = new URL(url);
	if (!parsed.searchParams.has("connection_limit")) {
		parsed.searchParams.set("connection_limit", "5");
	}
	if (!parsed.searchParams.has("pool_timeout")) {
		parsed.searchParams.set("pool_timeout", "30");
	}
	if (!parsed.searchParams.has("connect_timeout")) {
		parsed.searchParams.set("connect_timeout", "10");
	}
	return parsed.toString();
}

const createPrismaClient = () =>
	new PrismaClient({
		datasources: {
			db: {
				url: buildDatabaseUrl(env.databaseUrl || env.databaseDirectUrl),
			},
		},
		log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
	});

export const prisma = globalThis.__broadyPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalThis.__broadyPrisma = prisma;
}
