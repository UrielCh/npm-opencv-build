import { path } from "../deps.ts";

/**
 * portable env functions
 */

export function getEnv(name: string): string {
  if (!name) {
    return "";
  }
  // const value = process.env[name];
  const value = Deno.env.get(name);
  return value || "";
}

export function setEnv(name: string, value: string): void {
  // process.env[name] = value;
  Deno.env.set(name, value);
}

export function getDirname(): string {
  // return __dirname if it's a nodejs script
  // if (typeof __dirname !== "undefined") {
  // return __dirname;
  // }
  // return import.meta.url if it's a module
  const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
  return __dirname; // new URL(".", import.meta.url).pathname;
}

export class Platfrm {
  public static theOS: string = Deno.build.os; // process.platform;

  public static changeOS(os: "windows" | "linux" | "darwin" | string) {
    Platfrm.theOS = os;
  }
  public static get isWindows() {
    return Platfrm.theOS.startsWith("win"); //  === 'windows';
  }
  public static get isLinux() {
    return Platfrm.theOS === "linux";
  }
  public static get isMac() {
    return Platfrm.theOS === "darwin";
  }
}

export function getArch(): string {
  // return process.arch;
  return Deno.build.arch;
}
