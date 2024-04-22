/**
 * portable env functions
 * 
 */

export function getEnv(name: string): string {
    const value = process.env[name];
    return value || '';
}

export function setEnv(name: string, value: string): void {
    process.env[name] = value;
}
