import log, { LogLevels } from "npmlog";

export default class Log {
  public static silence: boolean;

  public static log(
    level: LogLevels | string,
    prefix: string,
    message: string,
    ...args: unknown[]
  ): void {
    if (!Log.silence) {
      log.log(level, prefix, message, ...args);
    }
  }
}
