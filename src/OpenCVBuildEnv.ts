import fs, { Stats } from "fs";
import os from "os";
import path from "path";
import log, { LogLevels } from "npmlog";
import { formatNumber, highlight, isCudaAvailable } from "./utils";
import crypto from "crypto";
import { AutoBuildFile, EnvSummery } from "./types";
import {
  ALLARGS,
  ArgInfo,
  MODEULES_MAP,
  OPENCV_PATHS_ENV,
  OpenCVBuildEnvParams,
  OpenCVBuildEnvParamsBool,
  OpenCVBuildEnvParamsString,
  OpencvModulesType,
  OpenCVPackageBuildOptions,
} from "./misc";
import { ALL_OPENCV_MODULES } from "./misc";
import pc from "picocolors";
import * as detector from "./helper/detect";
import { getEnv, setEnv } from "./env";

function toBool(value?: string | null) {
  if (!value) {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value > 0;
  }
  value = value.toLowerCase();
  if (
    value === "0" || value === "false" || value === "off" ||
    value.startsWith("disa")
  ) {
    return false;
  }
  return true;
}

interface BuildDesc {
  autobuild: string;
  buildInfo: AutoBuildFile;
  dir: string;
  hash: string;
  date: Date;
}

// const DEFAULT_OPENCV_VERSION = '4.6.0';

export default class OpenCVBuildEnv
  implements OpenCVBuildEnvParamsBool, OpenCVBuildEnvParamsString {
  public static silence: boolean;

  public static log(
    level: LogLevels | string,
    prefix: string,
    message: string,
    ...args: unknown[]
  ): void {
    if (!OpenCVBuildEnv.silence) {
      log.log(level, prefix, message, ...args);
    }
  }

  public prebuild?:
    | "latestBuild"
    | "latestVersion"
    | "oldestBuild"
    | "oldestVersion";
  /**
   * set using env OPENCV4NODEJS_AUTOBUILD_OPENCV_VERSION , or --version or autoBuildOpencvVersion option in package.json
   */
  public opencvVersion: string;
  /**
   * set using env OPENCV4NODEJS_BUILD_CUDA , or --cuda or autoBuildBuildCuda option in package.json
   */
  public buildWithCuda = false;
  #cudaArch = "";

  get cudaArch(): string {
    const arch = this.#cudaArch;
    if (!arch) {
      return "";
    }
    if (!arch.match(/^(\d+\.\d+)(,\d+\.\d+)*$/)) {
      throw Error(
        `invalid value for cudaArch "${arch}" should be a list of valid cuda arch separated by comma like: "7.5,8.6"`,
      );
    }
    return arch;
  }
  /**
   * set using env OPENCV4NODEJS_AUTOBUILD_WITHOUT_CONTRIB, or --nocontrib arg, or autoBuildWithoutContrib option in package.json
   */
  public isWithoutContrib = false;
  /**
   * set using env OPENCV4NODEJS_DISABLE_AUTOBUILD, or --nobuild arg or disableAutoBuild option in package.json
   */
  public isAutoBuildDisabled = false;
  /**
   * set using --keepsources arg or keepsources option in package.json
   */
  public keepsources = false;
  /**
   * set using --dry-run arg or dry-run option in package.json
   */
  public dryRun = false;
  public gitCache = false;
  // root path to look for package.json opencv4nodejs section
  // deprecated directly infer your parameters to the constructor
  public autoBuildFlags: string;
  // legacy path to package.json dir
  public rootcwd?: string;
  // Path to build all openCV libs
  public buildRoot: string;
  // Path to find package.json legacy option
  public packageRoot: string;
  protected _platform: NodeJS.Platform;
  private no_autobuild: string;

  /**
   * Find the proper root dir, this directory will contains all openCV source code and a subfolder per build
   * @param opts
   * @returns
   */
  public static getBuildDir(opts = {} as OpenCVBuildEnvParams) {
    let buildRoot = opts.buildRoot || getEnv("OPENCV_BUILD_ROOT") ||
      path.join(__dirname, "..");
    if (buildRoot[0] === "~") {
      buildRoot = path.join(os.homedir(), buildRoot.slice(1));
    }
    return buildRoot;
  }

  /**
   * list existing build in the diven directory
   * @param rootDir build directory
   * @returns builds list
   */
  public static listBuild(rootDir: string): Array<BuildDesc> {
    const versions = fs.readdirSync(rootDir)
      .filter((n) => n.startsWith("opencv-"))
      .map((dir) => {
        const autobuild = path.join(rootDir, dir, "auto-build.json");
        try {
          const stats = fs.statSync(autobuild);
          const hash = dir.replace(/^opencv-.+-/, "-");
          const buildInfo = OpenCVBuildEnv.readAutoBuildFile(
            autobuild,
            true,
          ) as AutoBuildFile;
          return { autobuild, dir, hash, buildInfo, date: stats.mtime };
        } catch (err) {
          return {
            autobuild,
            dir,
            hash: "",
            buildInfo: null,
            date: 0,
          } as unknown as BuildDesc;
        }
      })
      .filter((n) => n.buildInfo);
    return versions;
  }

  /**
   * Read a parse an existing autoBuildFile
   * @param autoBuildFile file path
   * @returns
   */
  public static readAutoBuildFile(
    autoBuildFile: string,
    quiet?: boolean,
  ): AutoBuildFile | undefined {
    try {
      const fileExists = fs.existsSync(autoBuildFile);
      if (fileExists) {
        const autoBuildFileData = JSON.parse(
          fs.readFileSync(autoBuildFile).toString(),
        ) as AutoBuildFile;
        if (
          !autoBuildFileData.opencvVersion ||
          !("autoBuildFlags" in autoBuildFileData) ||
          !Array.isArray(autoBuildFileData.modules)
        ) {
          // if (quiet) return undefined;
          throw new Error(
            `auto-build.json has invalid contents, please delete the file: ${autoBuildFile}`,
          );
        }
        return autoBuildFileData;
      }
      if (!quiet) {
        OpenCVBuildEnv.log(
          "info",
          "readAutoBuildFile",
          "file does not exists: %s",
          autoBuildFile,
        );
      }
    } catch (err) {
      //if (!quiet)
      if (err instanceof Error) {
        OpenCVBuildEnv.log(
          "error",
          "readAutoBuildFile",
          "failed to read auto-build.json from: %s, with error: %s",
          autoBuildFile,
          err.toString(),
        );
      } else {
        OpenCVBuildEnv.log(
          "error",
          "readAutoBuildFile",
          "failed to read auto-build.json from: %s, with error: %s",
          autoBuildFile,
          JSON.stringify(err),
        );
      }
    }
    return undefined;
  }

  /**
   * autodetect path using common values.
   * @return number of updated env variable from 0 to 3
   */
  public static autoLocatePrebuild(): { changes: number; summery: string[] } {
    let changes = 0;
    const summery = [] as string[];
    if (!getEnv("OPENCV_BIN_DIR")) {
      const candidate = detector.detectBinDir();
      if (candidate) {
        setEnv("OPENCV_BIN_DIR", candidate);
        changes++;
      }
    }
    if (!getEnv("OPENCV_LIB_DIR")) {
      const candidate = detector.detectLibDir();
      if (candidate) {
        setEnv("OPENCV_LIB_DIR", candidate);
        changes++;
      }
    }
    if (!getEnv("OPENCV_INCLUDE_DIR")) {
      const candidate = detector.detectIncludeDir();
      if (candidate) {
        setEnv("OPENCV_INCLUDE_DIR", candidate);
        changes++;
      }
    }
    return { changes, summery };
  }

  private getExpectedVersion(defaultVersion?: string): string {
    if (this.no_autobuild) {
      return "0.0.0";
    }
    const opencvVersion = this.resolveValue(ALLARGS.version);
    if (opencvVersion) {
      return opencvVersion;
    }
    return defaultVersion || "";
    // return '0.0.0'; //DEFAULT_OPENCV_VERSION;
  }

  // private getExpectedBuildWithCuda(): boolean {
  //     return !!this.resolveValue(ALLARGS.cuda);
  // }
  // this.autoBuildFlags = this.resolveValue(ALLARGS.flags);
  // this.#cudaArch = this.resolveValue(ALLARGS.cudaArch);
  // this.isWithoutContrib = !!this.resolveValue(ALLARGS.nocontrib);
  // this.isAutoBuildDisabled = !!this.resolveValue(ALLARGS.nobuild);
  // this.keepsources = !!this.resolveValue(ALLARGS.keepsources);
  // this.dryRun = !!this.resolveValue(ALLARGS['dry-run']);
  // this.gitCache = !!this.resolveValue(ALLARGS['git-cache']);

  private resolveValue(info: ArgInfo): string {
    let value = "";
    if (info.conf in this.opts) {
      value = this.opts[info.conf] as string || "";
    } else {
      if (this.#packageEnv && this.#packageEnv[info.conf]) {
        value = this.#packageEnv[info.conf] || "";
      } else {
        value = getEnv(info.env) || "";
      }
    }
    if (info.isBool) {
      return toBool(value) ? "1" : "";
    } else {
      return value;
    }
  }
  #packageEnv: OpenCVPackageBuildOptions = {};

  constructor(private opts = {} as OpenCVBuildEnvParams) {
    this.prebuild = opts.prebuild;
    this._platform = process.platform;
    this.packageRoot = opts.rootcwd || getEnv("INIT_CWD") || process.cwd();
    this.buildRoot = OpenCVBuildEnv.getBuildDir(opts);
    // get project Root path to looks for package.json for opencv4nodejs section
    try {
      const data = OpenCVBuildEnv.readEnvsFromPackageJson();
      if (data === null && !this.prebuild) {
        OpenCVBuildEnv.log(
          "info",
          "config",
          `No file ${highlight("%s")} found for opencv4nodejs import`,
          OpenCVBuildEnv.getPackageJson(),
        );
      }
      if (data) {
        this.#packageEnv = data;
      }
    } catch (err) {
      OpenCVBuildEnv.log(
        "error",
        "applyEnvsFromPackageJson",
        "failed to parse package.json:",
      );
      if (err instanceof Error) {
        OpenCVBuildEnv.log("error", "applyEnvsFromPackageJson", err.toString());
      } else {
        OpenCVBuildEnv.log(
          "error",
          "applyEnvsFromPackageJson",
          JSON.stringify(err),
        );
      }
    }
    // try to use previouse build
    this.no_autobuild = toBool(this.resolveValue(ALLARGS.nobuild)) ? "1" : "";

    if (!this.no_autobuild && opts.prebuild) {
      const builds = OpenCVBuildEnv.listBuild(this.rootDir);
      if (!builds.length) {
        throw Error(
          `No build found in ${this.rootDir} you should launch opencv-build-npm once`,
        );
      }
      const expVer = this.getExpectedVersion("0.0.0");
      /**
       * try to match the expected version
       */
      let buildV = builds;
      if (expVer != "0.0.0") {
        buildV = buildV.filter((b) => b.buildInfo.opencvVersion === expVer);
      }
      /**
       * but if no match, use the latest build with a different version number.
       */
      // if (buildV.length)
      //     builds = buildV;
      if (!buildV.length) {
        throw Error(
          `No build of version ${expVer} found in ${this.rootDir} you should launch opencv-build-npm Available versions are: ${
            builds.map((b) => b.buildInfo.opencvVersion).join(", ")
          }`,
        );
      }
      if (buildV.length > 1) {
        switch (opts.prebuild) {
          case "latestBuild":
            builds.sort((a, b) => b.date.getTime() - a.date.getTime());
            break;
          case "latestVersion":
            builds.sort((a, b) => b.dir.localeCompare(a.dir));
            break;
          case "oldestBuild":
            builds.sort((a, b) => a.date.getTime() - b.date.getTime());
            break;
          case "oldestVersion":
            builds.sort((a, b) => a.dir.localeCompare(b.dir));
            break;
        }
      }
      // load envthe prevuious build
      const autoBuildFile = builds[0].buildInfo;
      //const autoBuildFile = OpenCVBuildEnv.readAutoBuildFile(builds[0].autobuild);
      //if (!autoBuildFile)
      //    throw Error(`failed to read build info from ${builds[0].autobuild}`);
      const flagStr = autoBuildFile.env.autoBuildFlags;
      this.hash = builds[0].hash;
      // merge -DBUILD_opencv_ to internal BUILD_opencv_ manager
      if (flagStr) {
        const flags = flagStr.split(/\s+/);
        flags.filter((flag) => {
          if (flag.startsWith("-DBUILD_opencv_")) {
            // eslint-disable-next-line prefer-const
            let [mod, activated] = flag.substring(15).split("=");
            activated = activated.toUpperCase();
            if (activated === "ON" || activated === "1") {
              this.#enabledModules.add(mod as OpencvModulesType);
            } else if (activated === "OFF" || activated === "0") {
              this.#enabledModules.delete(mod as OpencvModulesType);
            }
            return false;
          }
          return true;
        });
      }
      this.autoBuildFlags = flagStr;
      this.buildWithCuda = autoBuildFile.env.buildWithCuda;
      this.isAutoBuildDisabled = autoBuildFile.env.isAutoBuildDisabled;
      this.isWithoutContrib = autoBuildFile.env.isWithoutContrib;
      this.opencvVersion = autoBuildFile.env.opencvVersion;
      this.buildRoot = autoBuildFile.env.buildRoot;

      OpenCVBuildEnv.log(
        "debug",
        "OpenCVBuildEnv",
        `autoBuildFlags=${highlight(this.autoBuildFlags)}`,
      );
      OpenCVBuildEnv.log(
        "debug",
        "OpenCVBuildEnv",
        `buildWithCuda=${highlight("" + (!!this.buildWithCuda))}`,
      );
      OpenCVBuildEnv.log(
        "debug",
        "OpenCVBuildEnv",
        `isAutoBuildDisabled=${highlight("" + (this.isAutoBuildDisabled))}`,
      );
      OpenCVBuildEnv.log(
        "debug",
        "OpenCVBuildEnv",
        `isWithoutContrib=${highlight("" + (!!this.isWithoutContrib))}`,
      );
      OpenCVBuildEnv.log(
        "debug",
        "OpenCVBuildEnv",
        `opencvVersion=${highlight(this.opencvVersion)}`,
      );
      OpenCVBuildEnv.log(
        "debug",
        "OpenCVBuildEnv",
        `buildRoot=${highlight(this.buildRoot)}`,
      );

      if (!this.opencvVersion) {
        throw Error(
          `autobuild file is corrupted, opencvVersion is missing in ${
            builds[0].autobuild
          }`,
        );
      }
      setEnv("OPENCV_BIN_DIR", autoBuildFile.env.OPENCV_BIN_DIR);
      setEnv("OPENCV_INCLUDE_DIR", autoBuildFile.env.OPENCV_INCLUDE_DIR);
      setEnv("OPENCV_LIB_DIR", autoBuildFile.env.OPENCV_LIB_DIR);

      if (this.buildWithCuda && isCudaAvailable()) {
        this.#enabledModules.add("cudaarithm");
        this.#enabledModules.add("cudabgsegm");
        this.#enabledModules.add("cudacodec");
        this.#enabledModules.add("cudafeatures2d");
        this.#enabledModules.add("cudafilters");
        this.#enabledModules.add("cudaimgproc");
        // this.#enabledModules.add('cudalegacy');
        this.#enabledModules.add("cudaobjdetect");
        this.#enabledModules.add("cudaoptflow");
        this.#enabledModules.add("cudastereo");
        this.#enabledModules.add("cudawarping");
      }
      return;
    }
    // try to build a new openCV or use a prebuilt one
    if (this.no_autobuild) {
      this.opencvVersion = "0.0.0";
      OpenCVBuildEnv.log("info", "init", `no_autobuild is set.`);
      const changes = OpenCVBuildEnv.autoLocatePrebuild();
      OpenCVBuildEnv.log("info", "init", changes.summery.join("\n"));
    } else {
      this.opencvVersion = this.getExpectedVersion("4.9.0");
      OpenCVBuildEnv.log(
        "info",
        "init",
        `using openCV verison ${formatNumber(this.opencvVersion)}`,
      );

      if (getEnv("INIT_CWD")) {
        OpenCVBuildEnv.log(
          "info",
          "init",
          `${highlight("INIT_CWD")} is defined overwriting root path to ${
            highlight(getEnv("INIT_CWD"))
          }`,
        );
      }
      // ensure that OpenCV workdir exists
      if (!fs.existsSync(this.buildRoot)) {
        fs.mkdirSync(this.buildRoot);
        if (!fs.existsSync(this.buildRoot)) {
          throw new Error(`${this.buildRoot} can not be create`);
        }
      }
    }

    // import configuration from package.json
    const envKeys = Object.keys(this.#packageEnv);
    if (envKeys.length) {
      // print all imported variables
      OpenCVBuildEnv.log(
        "info",
        "applyEnvsFromPackageJson",
        "the following opencv4nodejs environment variables are set in the package.json:",
      );
      envKeys.forEach((key: string) =>
        OpenCVBuildEnv.log(
          "info",
          "applyEnvsFromPackageJson",
          `${highlight(key)}: ${
            formatNumber(
              this.#packageEnv[key as keyof OpenCVPackageBuildOptions] || "",
            )
          }`,
        )
      );
    }

    this.autoBuildFlags = this.resolveValue(ALLARGS.flags);
    this.buildWithCuda = !!this.resolveValue(ALLARGS.cuda);
    this.#cudaArch = this.resolveValue(ALLARGS.cudaArch);
    this.isWithoutContrib = !!this.resolveValue(ALLARGS.nocontrib);
    this.isAutoBuildDisabled = !!this.resolveValue(ALLARGS.nobuild);
    this.keepsources = !!this.resolveValue(ALLARGS.keepsources);
    this.dryRun = !!this.resolveValue(ALLARGS["dry-run"]);
    this.gitCache = !!this.resolveValue(ALLARGS["git-cache"]);

    if (this.buildWithCuda && isCudaAvailable()) {
      this.#enabledModules.add("cudaarithm");
      this.#enabledModules.add("cudabgsegm");
      this.#enabledModules.add("cudacodec");
      this.#enabledModules.add("cudafeatures2d");
      this.#enabledModules.add("cudafilters");
      this.#enabledModules.add("cudaimgproc");
      // this.#enabledModules.add('cudalegacy');
      this.#enabledModules.add("cudaobjdetect");
      this.#enabledModules.add("cudaoptflow");
      this.#enabledModules.add("cudastereo");
      this.#enabledModules.add("cudawarping");
    }
  }

  #ready = false;
  /**
   * complet initialisation.
   */
  private getReady(): void {
    if (this.#ready) {
      return;
    }
    this.#ready = true;
    for (const varname of ["binDir", "incDir", "libDir"]) {
      const varname2 = varname as "binDir" | "incDir" | "libDir";
      const value = this.resolveValue(ALLARGS[varname2]);
      if (value && getEnv(varname) !== value) {
        setEnv(ALLARGS[varname2].env, value);
      }
    }
    if (this.no_autobuild) {
      // Try autoDetect opencv paths
      if (
        !getEnv("OPENCV_BIN_DIR") || !getEnv("OPENCV_LIB_DIR") ||
        !getEnv("OPENCV_INCLUDE_DIR")
      ) {
        detector.applyDetect();
      }

      /**
       * no autobuild, all OPENCV_PATHS_ENV should be defined
       */
      const errors = [];
      for (const varname of OPENCV_PATHS_ENV) {
        const value = getEnv(varname);
        if (!value) {
          errors.push(
            `${varname} must be define if auto-build is disabled, and autodetection failed`,
          );
          continue;
        }
        let stats: Stats;
        try {
          stats = fs.statSync(value);
        } catch (e) {
          errors.push(`${varname} is set to non existing "${value}"`);
          continue;
        }
        if (!stats.isDirectory()) {
          errors.push(
            `${varname} is set to "${value}", that should be a directory`,
          );
        }
      }
      if (errors.length) {
        throw Error([...errors, ...detector.summery].join("\n"));
      }
    }
  }

  /** default module build list */
  #enabledModules = new Set<OpencvModulesType>(
    Object.entries(MODEULES_MAP).filter(([, v]) => v).map(([k]) =>
      k as OpencvModulesType
    ),
  );

  public get enabledModules(): OpencvModulesType[] {
    return [...this.#enabledModules];
  }

  public enableModule(mod: OpencvModulesType) {
    if (this.#ready) {
      throw Error(
        "No mode modules change can be done after initialisation done.",
      );
    }
    this.#enabledModules.add(mod);
  }

  public disableModule(mod: OpencvModulesType) {
    if (this.#ready) {
      throw Error(
        "No mode modules change can be done after initialisation done.",
      );
    }
    this.#enabledModules.delete(mod);
  }

  /**
   * @returns return cmake flags like: -DBUILD_opencv_modules=ON ...
   */
  public getCmakeBuildFlags(): string[] {
    const out: string[] = [];
    for (const mod of ALL_OPENCV_MODULES) {
      const value = this.#enabledModules.has(mod) ? "ON" : "OFF";
      if (value === "OFF" && MODEULES_MAP[mod] === null) {
        continue;
      }
      out.push(`-DBUILD_opencv_${mod}=${value}`);
    }
    return out.sort();
  }

  // if version < 4.5.6 ffmpeg 5 not compatible
  // https://stackoverflow.com/questions/71070080/building-opencv-from-source-in-mac-m1
  // brew install ffmpeg@4
  // brew unlink ffmpeg
  // brew link ffmpeg@4

  public getSharedCmakeFlags(): string[] {
    const cMakeflags = [
      `-DCMAKE_INSTALL_PREFIX=${this.opencvBuild}`,
      "-DCMAKE_BUILD_TYPE=Release",
      "-DCMAKE_BUILD_TYPES=Release",
      "-DBUILD_EXAMPLES=OFF", // do not build opencv_contrib samples
      "-DBUILD_DOCS=OFF",
      "-DBUILD_TESTS=OFF",
      "-DBUILD_opencv_dnn=ON", // added 28/12/2022
      "-DENABLE_FAST_MATH=ON",
      "-DBUILD_PERF_TESTS=OFF",
      "-DBUILD_JAVA=OFF",
      "-DBUILD_ZLIB=OFF", // https://github.com/opencv/opencv/issues/21389
      "-DCUDA_NVCC_FLAGS=--expt-relaxed-constexpr",
      "-DWITH_VTK=OFF",
    ];
    if (!this.isWithoutContrib) {
      cMakeflags.push(
        "-DOPENCV_ENABLE_NONFREE=ON",
        `-DOPENCV_EXTRA_MODULES_PATH=${this.opencvContribModules}`,
      );
    }
    cMakeflags.push(...this.getConfiguredCmakeFlags());
    return cMakeflags;
    // .cMakeflags.push('-DCMAKE_SYSTEM_PROCESSOR=arm64', '-DCMAKE_OSX_ARCHITECTURES=arm64');
  }

  private getConfiguredCmakeFlagsOnce = false;

  public getConfiguredCmakeFlags(): string[] {
    const cMakeflags = [];
    if (this.buildWithCuda) {
      if (isCudaAvailable()) {
        // OpenCVBuildEnv.log('info', 'install', 'Adding CUDA flags...');
        // this.enabledModules.delete('cudacodec');// video codec (NVCUVID) is deprecated in cuda 10, so don't add it
        cMakeflags.push(
          "-DWITH_CUDA=ON",
          "-DCUDA_FAST_MATH=ON", /* optional */
          "-DWITH_CUBLAS=ON", /* optional */
          "-DOPENCV_DNN_CUDA=ON",
        );

        this.#enabledModules.add("cudaarithm");
        this.#enabledModules.add("cudabgsegm");
        this.#enabledModules.add("cudacodec");
        this.#enabledModules.add("cudafeatures2d");
        this.#enabledModules.add("cudafilters");
        this.#enabledModules.add("cudaimgproc");
        // this.#enabledModules.add('cudalegacy');
        this.#enabledModules.add("cudaobjdetect");
        this.#enabledModules.add("cudaoptflow");
        this.#enabledModules.add("cudastereo");
        this.#enabledModules.add("cudawarping");

        const cudaArch = this.cudaArch;
        if (cudaArch) {
          cMakeflags.push(`-DCUDA_ARCH_BIN=${cudaArch}`);
        }
      } else {
        if (!this.getConfiguredCmakeFlagsOnce) {
          OpenCVBuildEnv.log("error", "install", "failed to locate CUDA setup");
        }
      }
    }

    // add user added flags
    if (this.autoBuildFlags && typeof (this.autoBuildFlags) === "string") {
      const addedFlags = this.autoBuildFlags.split(/\s+/);
      const buildList = addedFlags.find((a) => a.startsWith("-DBUILD_LIST"));
      if (buildList) {
        if (!this.getConfiguredCmakeFlagsOnce) {
          OpenCVBuildEnv.log(
            "info",
            "config",
            `cmake flag contains special ${pc.red("DBUILD_LIST")} options "${
              highlight("%s")
            }" automatic cmake flags are now disabled.`,
            buildList,
          );
        }
        const extraModules = (buildList.split("=")[1] || "").split(",").filter(
          (a) => a,
        );
        for (const extraModule of extraModules) {
          // drop any --DWITH_
          ALL_OPENCV_MODULES.delete(extraModule as OpencvModulesType);
          // or use --DWITH_modules=ON
          // this.#enabledModules.add(extraModule as OpencvModulesType);
        }
      } else {
        cMakeflags.push(...this.getCmakeBuildFlags());
      }
      // OpenCVBuildEnv.log('silly', 'install', 'using flags from OPENCV4NODEJS_AUTOBUILD_FLAGS:', this.autoBuildFlags)
      // cMakeflags.push(...this.autoBuildFlags.split(/\s+/));
      for (const arg of addedFlags) {
        const m = arg.match(/^(-D.+=)(.+)$/);
        if (!m) {
          cMakeflags.push(arg);
          continue;
        }
        const [, key] = m;
        const pos = cMakeflags.findIndex((a) => a.startsWith(key));
        if (pos >= 0) {
          if (cMakeflags[pos] === arg) {
            if (!this.getConfiguredCmakeFlagsOnce) {
              OpenCVBuildEnv.log(
                "info",
                "config",
                `cmake flag "${highlight("%s")}" had no effect.`,
                arg,
              );
            }
          } else {
            if (!this.getConfiguredCmakeFlagsOnce) {
              OpenCVBuildEnv.log(
                "info",
                "config",
                `replacing cmake flag "${highlight("%s")}" by "${
                  highlight("%s")
                }"`,
                cMakeflags[pos],
                m[0],
              );
            }
            cMakeflags[pos] = m[0];
          }
        } else {
          if (!this.getConfiguredCmakeFlagsOnce) {
            OpenCVBuildEnv.log(
              "info",
              "config",
              `adding cmake flag "${highlight("%s")}"`,
              m[0],
            );
          }
          cMakeflags.push(m[0]);
        }
      }
    } else {
      cMakeflags.push(...this.getCmakeBuildFlags());
    }
    // console.log(cMakeflags)
    this.getConfiguredCmakeFlagsOnce = true;
    return cMakeflags;
  }

  public dumpEnv(): EnvSummery {
    return {
      opencvVersion: this.opencvVersion,
      buildWithCuda: this.buildWithCuda,
      isWithoutContrib: this.isWithoutContrib,
      isAutoBuildDisabled: this.isAutoBuildDisabled,
      autoBuildFlags: this.autoBuildFlags,
      cudaArch: this.cudaArch,
      buildRoot: this.buildRoot,
      OPENCV_INCLUDE_DIR: getEnv("OPENCV_INCLUDE_DIR"),
      OPENCV_LIB_DIR: getEnv("OPENCV_LIB_DIR"),
      OPENCV_BIN_DIR: getEnv("OPENCV_BIN_DIR"),
      modules: [...this.#enabledModules].sort(),
    };
  }

  private static getPackageJson(): string {
    return path.resolve(process.cwd(), "package.json");
  }

  /**
   * extract opencv4nodejs section from package.json if available
   */
  private static parsePackageJson(): {
    file: string;
    data: { opencv4nodejs?: { [key: string]: string | boolean | number } };
  } | null {
    const absPath = OpenCVBuildEnv.getPackageJson();
    if (!fs.existsSync(absPath)) {
      return null;
    }
    const data = JSON.parse(fs.readFileSync(absPath).toString());
    return { file: absPath, data };
  }

  public numberOfCoresAvailable(): number {
    return os.cpus().length;
  }

  private static readEnvsFromPackageJsonLog = 0;
  /**
   * get opencv4nodejs section from package.json if available
   * @returns opencv4nodejs customs
   */
  public static readEnvsFromPackageJson(): {
    [key: string]: string | boolean | number;
  } | null {
    const rootPackageJSON = OpenCVBuildEnv.parsePackageJson();
    if (!rootPackageJSON) {
      return null;
    }

    if (!rootPackageJSON.data) {
      if (!OpenCVBuildEnv.readEnvsFromPackageJsonLog++) {
        OpenCVBuildEnv.log(
          "info",
          "config",
          `looking for opencv4nodejs option from ${highlight("%s")}`,
          rootPackageJSON.file,
        );
      }
      return {};
    }
    if (!rootPackageJSON.data.opencv4nodejs) {
      if (!OpenCVBuildEnv.readEnvsFromPackageJsonLog++) {
        OpenCVBuildEnv.log(
          "info",
          "config",
          `no opencv4nodejs section found in ${highlight("%s")}`,
          rootPackageJSON.file,
        );
      }
      return {};
    }
    if (!OpenCVBuildEnv.readEnvsFromPackageJsonLog++) {
      OpenCVBuildEnv.log(
        "info",
        "config",
        `found opencv4nodejs section in ${highlight("%s")}`,
        rootPackageJSON.file,
      );
    }
    return rootPackageJSON.data.opencv4nodejs;
  }
  private hash = "";
  /**
   * openCV uniq version prostfix, used to avoid build path colision.
   */
  get optHash(): string {
    if (this.hash) {
      return this.hash;
    }
    let optArgs = this.getConfiguredCmakeFlags().join(" ");
    if (this.buildWithCuda) optArgs += "cuda";
    if (this.isWithoutContrib) optArgs += "noContrib";
    if (optArgs) {
      optArgs = "-" +
        crypto.createHash("md5").update(optArgs).digest("hex").substring(0, 5);
    }
    // do not cache the opt hash, it can change during the configuration process.
    // it will be fix durring the final serialisation.
    // this.hash = optArgs;
    return optArgs;
  }

  public get platform(): NodeJS.Platform {
    return this._platform;
  }

  public setPlatform(p: NodeJS.Platform): void {
    this._platform = p;
  }

  public get isWin(): boolean {
    return this.platform === "win32";
  }

  public get rootDir(): string {
    // const __filename = fileURLToPath(import.meta.url);
    // const __dirname = dirname(__filename);
    // return path.resolve(__dirname, '../');
    return this.buildRoot;
  }
  public get opencvRoot(): string {
    return path.join(
      this.rootDir,
      `opencv-${this.opencvVersion}${this.optHash}`,
    );
  }

  public get opencvGitCache(): string {
    return path.join(this.rootDir, "opencvGit");
  }

  public get opencvContribGitCache(): string {
    return path.join(this.rootDir, "opencv_contribGit");
  }

  public get opencvSrc(): string {
    return path.join(this.opencvRoot, "opencv");
  }
  public get opencvContribSrc(): string {
    return path.join(this.opencvRoot, "opencv_contrib");
  }
  public get opencvContribModules(): string {
    return path.join(this.opencvContribSrc, "modules");
  }
  public get opencvBuild(): string {
    return path.join(this.opencvRoot, "build");
  }
  public get opencvInclude(): string {
    return path.join(this.opencvBuild, "include");
  }
  public get opencv4Include(): string {
    this.getReady();
    const candidat = getEnv("OPENCV_INCLUDE_DIR");
    if (candidat) return candidat;
    return path.join(this.opencvInclude, "opencv4");
  }
  public get opencvIncludeDir(): string {
    this.getReady();
    return getEnv("OPENCV_INCLUDE_DIR");
  }
  public get opencvLibDir(): string {
    this.getReady();
    const candidat = getEnv("OPENCV_LIB_DIR");
    if (candidat) return candidat;
    return this.isWin
      ? path.join(this.opencvBuild, "lib/Release")
      : path.join(this.opencvBuild, "lib");
  }
  public get opencvBinDir(): string {
    this.getReady();
    const candidat = getEnv("OPENCV_BIN_DIR");
    if (candidat) return candidat;
    return this.isWin
      ? path.join(this.opencvBuild, "bin/Release")
      : path.join(this.opencvBuild, "bin");
  }
  public get autoBuildFile(): string {
    return path.join(this.opencvRoot, "auto-build.json");
  }
  public get autoBuildLog(): string {
    if (this.isWin) {
      return path.join(this.opencvRoot, "build-cmd.bat");
    } else {
      return path.join(this.opencvRoot, "build-cmd.sh");
    }
  }
  public readAutoBuildFile(): AutoBuildFile | undefined {
    return OpenCVBuildEnv.readAutoBuildFile(this.autoBuildFile);
  }
}
