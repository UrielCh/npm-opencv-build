import npmlog, { LogLevels } from "npm:npmlog";

export default class Log {
  public static silence: boolean;

  public static log(
    level: LogLevels | string,
    prefix: string,
    message: string,
    ...args: unknown[]
  ): void {
    if (!Log.silence) {
      npmlog.log(level, prefix, message, ...args);
    }
  }

  public static set level(level: LogLevels) {
    npmlog.level = level;
  }
}
