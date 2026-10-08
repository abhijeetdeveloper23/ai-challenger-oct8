import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { connectDb } from "./config/db.js";
import routes from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { log } from "./utils/logger.js";

async function bootstrap() {
  await connectDb();

  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many requests, please try again later." },
      handler: (req, res, _next, options) => {
        log.warn("http", `Rate limit exceeded — ${req.method} ${req.originalUrl}`, {
          ip: req.ip,
        });
        res.status(options.statusCode).json(options.message);
      },
    })
  );

  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  app.listen(env.PORT, () => {
    log.info("server", `Listening on http://localhost:${env.PORT}`);
    log.info("server", "Discovery config", {
      demoMode: env.DEMO_MODE,
      providers: env.DISCOVERY_PROVIDERS || env.DISCOVERY_PROVIDER,
      serpapi: Boolean(env.DISCOVERY_API_KEY),
      googlePlaces: Boolean(env.GOOGLE_PLACES_API_KEY),
      foursquare: Boolean(env.FOURSQUARE_API_KEY),
    });
  });
}

process.on("unhandledRejection", (reason) => {
  log.exception("process", "Unhandled promise rejection", reason);
});

process.on("uncaughtException", (err) => {
  log.exception("process", "Uncaught exception — shutting down", err);
  process.exit(1);
});

bootstrap().catch((err) => {
  log.exception("server", "Failed to start", err);
  process.exit(1);
});
