import type { Request, Response } from "express";
import mongoose from "mongoose";
import { env, isDemoMode, hasLiveDiscoveryKeys } from "../config/env.js";

export function getHealth(_req: Request, res: Response): void {
  res.json({
    status: "ok",
    demoMode: isDemoMode,
    discovery: {
      mode: env.DEMO_MODE ? "demo" : "live",
      providers: env.DISCOVERY_PROVIDERS || env.DISCOVERY_PROVIDER,
      serpapi: Boolean(env.DISCOVERY_API_KEY),
      googlePlaces: Boolean(env.GOOGLE_PLACES_API_KEY),
      foursquare: Boolean(env.FOURSQUARE_API_KEY),
      liveKeysConfigured: hasLiveDiscoveryKeys(),
    },
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
}
