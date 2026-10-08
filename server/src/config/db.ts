import mongoose from "mongoose";
import { env } from "./env.js";
import { log } from "../utils/logger.js";

export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("error", (err) => {
    log.exception("mongodb", "Connection error", err);
  });
  mongoose.connection.on("disconnected", () => {
    log.warn("mongodb", "Disconnected from MongoDB");
  });

  try {
    await mongoose.connect(env.MONGODB_URI);
    log.info("mongodb", `Connected — db="${mongoose.connection.name}"`);
  } catch (err) {
    log.exception("mongodb", "Failed to connect", err, {
      uriHost: env.MONGODB_URI.replace(/\/\/.*@/, "//***@"),
    });
    throw err;
  }
}
