"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLibs = exports.opencvBuildDir = exports.opencvBinDir = exports.opencvLibDir = exports.opencv4Include = exports.opencvInclude = exports.isUnix = exports.isWin = exports.isOSX = exports.applyEnvsFromPackageJson = exports.readEnvsFromPackageJson = exports.readAutoBuildFile = exports.isAutoBuildDisabled = exports.opencvModules = void 0;
const fs = require("fs");
const path = require("path");
const constants_1 = require("./constants");
const dirs_1 = require("./dirs");
const getLibsFactory_1 = require("./getLibsFactory");
const utils_1 = require("./utils");
var constants_2 = require("./constants");
Object.defineProperty(exports, "opencvModules", { enumerable: true, get: function () { return constants_2.opencvModules; } });
var env_1 = require("./env");
Object.defineProperty(exports, "isAutoBuildDisabled", { enumerable: true, get: function () { return env_1.isAutoBuildDisabled; } });
Object.defineProperty(exports, "readAutoBuildFile", { enumerable: true, get: function () { return env_1.readAutoBuildFile; } });
Object.defineProperty(exports, "readEnvsFromPackageJson", { enumerable: true, get: function () { return env_1.readEnvsFromPackageJson; } });
Object.defineProperty(exports, "applyEnvsFromPackageJson", { enumerable: true, get: function () { return env_1.applyEnvsFromPackageJson; } });
var utils_2 = require("./utils");
Object.defineProperty(exports, "isOSX", { enumerable: true, get: function () { return utils_2.isOSX; } });
Object.defineProperty(exports, "isWin", { enumerable: true, get: function () { return utils_2.isWin; } });
Object.defineProperty(exports, "isUnix", { enumerable: true, get: function () { return utils_2.isUnix; } });
/**
 * opencv include directory
 */
exports.opencvInclude = dirs_1.default.opencvInclude;
/**
 * opencv4 include directory
 */
exports.opencv4Include = dirs_1.default.opencv4Include;
/**
 * built lib directory
 */
exports.opencvLibDir = dirs_1.default.opencvLibDir;
/**
 * built bin directory
 */
exports.opencvBinDir = dirs_1.default.opencvBinDir;
/**
 * build directory
 */
exports.opencvBuildDir = dirs_1.default.opencvBuild;
/**
 * list available module + path as OpencvModule[]
 */
exports.getLibs = getLibsFactory_1.getLibsFactory({ isWin: utils_1.isWin, isOSX: utils_1.isOSX, opencvModules: constants_1.opencvModules, path, fs });
