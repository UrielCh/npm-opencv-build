import fs from "node:fs";
import { globSync } from "npm:glob";
import { highlight } from "../utils.ts";
import { Platfrm, setEnv } from "../env.ts";

export const summery = new Set<string>();

export function applyDetect(): void {
  const { OPENCV_BIN_DIR, OPENCV_LIB_DIR, OPENCV_INCLUDE_DIR } = detect();
  setEnv("OPENCV_BIN_DIR", OPENCV_BIN_DIR);
  setEnv("OPENCV_LIB_DIR", OPENCV_LIB_DIR);
  setEnv("OPENCV_INCLUDE_DIR", OPENCV_INCLUDE_DIR);
}

export function detect(): {
  OPENCV_BIN_DIR: string;
  OPENCV_LIB_DIR: string;
  OPENCV_INCLUDE_DIR: string;
} {
  const OPENCV_BIN_DIR = detectBinDir();
  const OPENCV_LIB_DIR = detectLibDir();
  const OPENCV_INCLUDE_DIR = detectIncludeDir();
  return { OPENCV_BIN_DIR, OPENCV_LIB_DIR, OPENCV_INCLUDE_DIR };
}

// detect_OPENCV_BIN_DIR
// detect_OPENCV_LIB_DIR
// detect_OPENCV_INCLUDE_DIR

export function detectBinDir(): string {
  // chocolatey
  if (Platfrm.isWindows) {
    const lookup = "c:/tools/opencv/build/x64/vc*/bin";
    // const candidates = ["c:\\tools\\opencv\\build\\x64\\vc14\\bin", "c:\\tools\\opencv\\build\\x64\\vc16\\bin"];
    const candidates = globSync(lookup);
    let fnd = false;
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        fnd = true;
        summery.add(`OPENCV_BIN_DIR resolved as ${highlight(candidate)}`);
        return candidate;
      }
    }
    if (!fnd) {
      summery.add(
        `failed to resolve OPENCV_BIN_DIR from ${lookup} => ${
          candidates.join(",")
        }`,
      );
    }
  } else if (Platfrm.isLinux) {
    const candidate = "/usr/bin/";
    if (fs.existsSync(candidate)) {
      summery.add("OPENCV_BIN_DIR resolved");
      return candidate;
    } else {
      summery.add(`failed to resolve OPENCV_BIN_DIR from ${candidate}`);
    }
  } else if (Platfrm.isMac) {
    const lookups = [
      "/opt/homebrew/Cellar/opencv/*/bin",
      "/usr/local/Cellar/opencv/*/bin",
    ];
    const candidates = [...globSync(lookups[0]), ...globSync(lookups[1])];
    if (candidates.length > 1) {
      summery.add(
        `homebrew detection found more than one openCV in ${lookups.join(",")}`,
      );
    }
    if (candidates.length) {
      const candidate = candidates[0];
      summery.add(`OPENCV_BIN_DIR resolved as ${candidate}`);
      return candidate;
    }
    summery.add(`failed to resolve OPENCV_BIN_DIR from ${lookups.join(",")}`);
  }
  return "";
}

export function detectLibDir(): string {
  if (Platfrm.isWindows) {
    // chocolatey
    const lookup = "c:/tools/opencv/build/x64/vc*/lib";
    // const candidates = ["c:\\tools\\opencv\\build\\x64\\vc14\\lib", "c:\\tools\\opencv\\build\\x64\\vc16\\lib"]
    const candidates = globSync(lookup); // blob looks broken
    let fnd = false;
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        fnd = true;
        summery.add(`OPENCV_LIB_DIR resolved as ${highlight(candidate)}`);
        return candidate;
      }
    }
    if (!fnd) {
      summery.add(
        `failed to resolve OPENCV_LIB_DIR from ${lookup} => ${
          candidates.join(",")
        }`,
      );
    }
  } else if (Platfrm.isLinux) {
    const lookup = "/usr/lib/*-linux-gnu";
    // tiny-blob need to be fix bypassing th issue
    //const [candidate] = fs.readdirSync('/usr/lib/').filter((a: string) => a.endsWith('-linux-gnu')).map(a => `/usr/lib/${a}`);
    const [candidate] = globSync(lookup);
    if (candidate) {
      summery.add(`OPENCV_LIB_DIR resolved as ${candidate}`);
      return candidate;
    } else {
      summery.add(`failed to resolve OPENCV_LIB_DIR from ${lookup}`);
    }
  } else if (Platfrm.isMac) {
    const lookups = [
      "/opt/homebrew/Cellar/opencv/*/lib",
      "/usr/local/Cellar/opencv/*/lib",
    ];
    const candidates = [...globSync(lookups[0]), ...globSync(lookups[1])];
    if (candidates.length > 1) {
      summery.add(
        `homebrew detection found more than one openCV in ${lookups.join(",")}`,
      );
    }
    if (candidates.length) {
      const candidate = candidates[0];
      summery.add(`OPENCV_LIB_DIR resolved as ${candidate}`);
      return candidate;
    } else {
      summery.add(`failed to resolve OPENCV_BIN_DIR from ${lookups.join(",")}`);
    }
  }
  return "";
}

/**
 * detect OPENCV_INCLUDE_DIR
 */
export function detectIncludeDir(): string {
  if (Platfrm.isWindows) {
    // chocolatey
    const candidate = "c:\\tools\\opencv\\build\\include";
    if (fs.existsSync(candidate)) {
      summery.add("OPENCV_INCLUDE_DIR resolved");
      return candidate;
    } else {
      summery.add(`failed to resolve OPENCV_INCLUDE_DIR from ${candidate}`);
    }
  } else if (Platfrm.isLinux) {
    const candidate = "/usr/include/opencv4/";
    if (fs.existsSync(candidate)) {
      summery.add(`OPENCV_INCLUDE_DIR resolved as ${candidate}`);
      return candidate;
    } else {
      summery.add(`failed to resolve OPENCV_INCLUDE_DIR from ${candidate}`);
    }
  } else if (Platfrm.isMac) {
    const lookups = [
      "/opt/homebrew/Cellar/opencv/*/include",
      "/usr/local/Cellar/opencv/*/include",
    ];
    const candidates = [...globSync(lookups[0]), ...globSync(lookups[1])];
    if (candidates.length > 1) {
      summery.add(
        `homebrew detection found more than one openCV in ${lookups.join(",")}`,
      );
    }
    if (candidates.length) {
      const candidate = candidates[0];
      summery.add(`OPENCV_INCLUDE_DIR resolved as ${candidate}`);
      return candidate;
    } else {
      summery.add(
        `failed to resolve OPENCV_INCLUDE_DIR from ${lookups.join(",")}`,
      );
    }
  }
  return "";
}
