/**
 * portable env functions
 */

export function getEnv(name: string): string {
  const value = process.env[name];
  return value || "";
}

export function setEnv(name: string, value: string): void {
  process.env[name] = value;
}

export function getDirname(): string {
  // return __dirname if it's a nodejs script
  if (typeof __dirname !== "undefined")
    return __dirname;
  // return import.meta.url if it's a module
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore ESM code
  return new URL(".", import.meta.url).pathname;
}
