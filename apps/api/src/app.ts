import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { env } from "./config/env.js";
import authRoutes from "./modules/auth/auth.routes.js";
import brandsRoutes from "./modules/brands/brands.routes.js";
import brandDashboardRoutes from "./modules/brands/brand-dashboard.routes.js";
import cartRoutes from "./modules/carts/cart.routes.js";
import ordersRoutes from "./modules/orders/orders.routes.js";
import productsRoutes from "./modules/products/products.routes.js";
import recommendationRoutes from "./modules/recommendations/recommendation.routes.js";
import reviewsRoutes from "./modules/reviews/reviews.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createIpRateLimiter } from "./middleware/rate-limit.js";

const app = express();

const allowedOrigins = new Set([
	env.webAppUrl,
	"http://localhost:3000",
	"http://localhost:3001",
	"http://localhost:3002",
]);

app.use(helmet());
app.use(
	cors({
		origin: (origin, callback) => {
			// Allow server-to-server requests and local dev frontend ports.
			if (!origin || allowedOrigins.has(origin)) {
				callback(null, true);
				return;
			}
			callback(new Error(`CORS blocked for origin: ${origin}`));
		},
		credentials: true,
	}),
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
app.use("/api", createIpRateLimiter("api-abuse", 60_000, 300));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "broady-api" }));

app.use("/api/auth", authRoutes);
app.use("/api/brands", brandsRoutes);
app.use("/api/brand-dashboard", brandDashboardRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/admin", adminRoutes);

app.use(errorHandler);

export default app;
