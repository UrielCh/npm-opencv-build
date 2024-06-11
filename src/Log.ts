// import log, { type LogLevels } from "npmlog";
import Logger from "@denodnt/logger";

export type LogLevels = "info" | "warn" | "error";
export const loggger = new Logger();

export default class Log {
  public static silence: boolean;

  public static log(
    level: LogLevels | string,
    prefix: string,
    message: string,
    ...args: unknown[]
  ): void {
    if (!Log.silence) {
      switch (level) {
        case "info":
          loggger.info(prefix, message, ...args);
          break;
        case "warn":
          loggger.warn(prefix, message, ...args);
          break;
        case "error":
          loggger.error(prefix, message, ...args);
          break;
        default:
          loggger.info(prefix, message, ...args);
          break;
      }
      // log.log(level, prefix, message, ...args);
    }
  }

  info(...args: unknown[]): Promise<void> {
    return loggger.info(...args);
  }

  warn(...args: unknown[]): Promise<void> {
    return loggger.warn(...args);
  }

  error(...args: unknown[]): Promise<void> {
    return loggger.error(...args);
  }

  silly(...args: unknown[]): Promise<void> {
    return loggger.info(...args);
  }

  verbose(...args: unknown[]): Promise<void> {
    return loggger.info(...args);
  }

}

export const log = new Log();