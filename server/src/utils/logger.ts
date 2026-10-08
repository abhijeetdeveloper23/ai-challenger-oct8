type LogLevel = "info" | "warn" | "error" | "debug";

function stamp(): string {
  return new Date().toISOString();
}

function write(level: LogLevel, scope: string, message: string, meta?: unknown) {
  const prefix = `[${stamp()}] [${level.toUpperCase()}] [${scope}] ${message}`;
  if (meta === undefined) {
    if (level === "error") console.error(prefix);
    else if (level === "warn") console.warn(prefix);
    else console.log(prefix);
    return;
  }

  if (level === "error") console.error(prefix, meta);
  else if (level === "warn") console.warn(prefix, meta);
  else console.log(prefix, meta);
}

/** Normalize unknown caught values for logging */
export function errMeta(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const axiosErr = err as Error & {
      response?: { status?: number; data?: unknown };
      code?: string;
      isAxiosError?: boolean;
    };
    return {
      name: err.name,
      message: err.message,
      code: axiosErr.code,
      status: axiosErr.response?.status,
      responseData:
        axiosErr.response?.data && typeof axiosErr.response.data === "object"
          ? axiosErr.response.data
          : undefined,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    };
  }
  return { message: String(err) };
}

export const log = {
  info: (scope: string, message: string, meta?: unknown) =>
    write("info", scope, message, meta),
  warn: (scope: string, message: string, meta?: unknown) =>
    write("warn", scope, message, meta),
  error: (scope: string, message: string, meta?: unknown) =>
    write("error", scope, message, meta),
  debug: (scope: string, message: string, meta?: unknown) =>
    write("debug", scope, message, meta),
  /** Log a caught exception with structured details */
  exception: (scope: string, message: string, err: unknown, meta?: Record<string, unknown>) =>
    write("error", scope, message, { ...errMeta(err), ...meta }),
};
