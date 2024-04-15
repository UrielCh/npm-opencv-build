import { globSync } from "glob";
import fs from "fs";
import { highlight } from "../utils";

export const summery = new Set<string>();

export function applyDetect(): void {
  const {OPENCV_BIN_DIR, OPENCV_LIB_DIR, OPENCV_INCLUDE_DIR} = detect();
  process.env.OPENCV_BIN_DIR = OPENCV_BIN_DIR;
  process.env.OPENCV_LIB_DIR = OPENCV_LIB_DIR;
  process.env.OPENCV_INCLUDE_DIR = OPENCV_INCLUDE_DIR;
}


export function detect(): {OPENCV_BIN_DIR: string, OPENCV_LIB_DIR: string, OPENCV_INCLUDE_DIR: string} {
  const OPENCV_BIN_DIR = detectBinDir();
  const OPENCV_LIB_DIR = detectLibDir();
  const OPENCV_INCLUDE_DIR = detectIncludeDir();
  return {OPENCV_BIN_DIR, OPENCV_LIB_DIR, OPENCV_INCLUDE_DIR};
}

// detect_OPENCV_BIN_DIR
// detect_OPENCV_LIB_DIR
// detect_OPENCV_INCLUDE_DIR

export function detectBinDir(): string {
  const os = process.platform;
  // chocolatey
  if (os === "win32") {
    const lookup = "c:/tools/opencv/build/x64/vc*/bin";
    // const candidates = ["c:\\tools\\opencv\\build\\x64\\vc14\\bin", "c:\\tools\\opencv\\build\\x64\\vc16\\bin"];
    const candidates = globSync(lookup);
    let fnd = false;
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        fnd = true;
        // process.env.OPENCV_BIN_DIR = candidate;
        summery.add(`OPENCV_BIN_DIR resolved as ${highlight(candidate)}`);
        return candidate;
        //changes++;
      }
    }
    if (!fnd) {
      summery.add(
        `failed to resolve OPENCV_BIN_DIR from ${lookup} => ${
          candidates.join(",")
        }`,
      );
    }
  } else if (os === "linux") {
    const candidate = "/usr/bin/";
    if (fs.existsSync(candidate)) {
      // process.env.OPENCV_BIN_DIR = candidate;
      summery.add("OPENCV_BIN_DIR resolved");
      return candidate;
      // changes++;
    } else {
      summery.add(`failed to resolve OPENCV_BIN_DIR from ${candidate}`);
    }
  } else if (os === "darwin") {
    const lookups = ["/opt/homebrew/Cellar/opencv/*/bin","/usr/local/Cellar/opencv/*/bin"];
    const candidates = [...globSync(lookups[0]), ...globSync(lookups[1])];
    if (candidates.length > 1) {
        summery.add(
            `homebrew detection found more than one openCV in ${lookups.join(",")}`,
          );
    }
    if (candidates.length) {
      const candidate = candidates[0];
      // process.env.OPENCV_BIN_DIR = candidate;
      summery.add(`OPENCV_BIN_DIR resolved as ${candidate}`);
      return candidate;
    }
    summery.add(`failed to resolve OPENCV_BIN_DIR from ${lookups.join(",")}`);
  }
  return "";
}

export function detectLibDir(): string {
  const os = process.platform;
  if (os === "win32") {
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
  } else if (os === "linux") {
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
  } else if (os === "darwin") {
    const lookups = ["/opt/homebrew/Cellar/opencv/*/lib","/usr/local/Cellar/opencv/*/lib"];
    const candidates = [...globSync(lookups[0]), ...globSync(lookups[1])];
      if (candidates.length > 1) {
        summery.add(
          `homebrew detection found more than one openCV in ${lookups.join(',')}`,
        );
      }
      if (candidates.length) {
        const candidate = candidates[0];
        summery.add(`OPENCV_LIB_DIR resolved as ${candidate}`);
        return candidate;
      } else {
        summery.add(`failed to resolve OPENCV_BIN_DIR from ${lookups.join(',')}`);
      }
  }
  return "";
}

/**
 * detect OPENCV_INCLUDE_DIR
 */
export function detectIncludeDir() : string {
  const os = process.platform;
  if (os === "win32") {
    // chocolatey
    const candidate = "c:\\tools\\opencv\\build\\include";
    if (fs.existsSync(candidate)) {
      summery.add('OPENCV_INCLUDE_DIR resolved');
      return candidate;
  } else {
      summery.add(`failed to resolve OPENCV_INCLUDE_DIR from ${candidate}`);
  }
  } else if (os === "linux") {
    const candidate = "/usr/include/opencv4/"
    if (fs.existsSync(candidate)) {
      summery.add(`OPENCV_INCLUDE_DIR resolved as ${candidate}`);
      return candidate;
    } else {
        summery.add(`failed to resolve OPENCV_INCLUDE_DIR from ${candidate}`);
    }
  } else if (os === "darwin") {
    const lookups = ["/opt/homebrew/Cellar/opencv/*/include","/usr/local/Cellar/opencv/*/include"];
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
      summery.add(`failed to resolve OPENCV_INCLUDE_DIR from ${lookups.join(",")}`);
    }
  }
  return "";
}
