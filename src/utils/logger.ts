type LogLevel = "info" | "warn" | "error" | "debug";

function write(level: LogLevel, message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (meta === undefined) {
    console.log(line);
    return;
  }

  console.log(line, meta);
}

export const logger = {
  info: (message: string, meta?: unknown) => write("info", message, meta),
  warn: (message: string, meta?: unknown) => write("warn", message, meta),
  error: (message: string, meta?: unknown) => write("error", message, meta),
  debug: (message: string, meta?: unknown) => write("debug", message, meta)
};
