"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.install = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const constants_1 = require("./constants");
const env_1 = require("./env");
const getLibsFactory_1 = require("./getLibsFactory");
const setupOpencv_1 = require("./setupOpencv");
const utils_1 = require("./utils");
const BuildContext_1 = require("./BuildContext");
;
const npmlog_1 = __importDefault(require("npmlog"));
/**
 * called from `npm run do-install` triggered by postinstall script
 */
const getLibs = (0, getLibsFactory_1.getLibsFactory)({ isWin: utils_1.isWin, isOSX: utils_1.isOSX, opencvModules: constants_1.opencvModules, path: path_1.default, fs: fs_1.default });
function checkInstalledLibs(ctxt, autoBuildFile) {
    let hasLibs = true;
    npmlog_1.default.info('install', 'checking for opencv libraries');
    if (!fs_1.default.existsSync(ctxt.opencvLibDir)) {
        npmlog_1.default.info('install', 'library dir does not exist:', ctxt.opencvLibDir);
        return;
    }
    const installedLibs = getLibs(ctxt.opencvLibDir);
    autoBuildFile.modules.forEach(({ opencvModule, libPath }) => {
        if (!libPath) {
            npmlog_1.default.info('install', '%s: %s', opencvModule, 'ignored');
            return;
        }
        const foundLib = installedLibs.find(lib => lib.opencvModule === opencvModule);
        hasLibs = hasLibs && !!foundLib;
        npmlog_1.default.info('install', '%s: %s', opencvModule, foundLib ? foundLib.libPath : 'not found');
    });
    return hasLibs;
}
async function install(ctxt) {
    if (!ctxt)
        ctxt = new BuildContext_1.BuildContext();
    // if project directory has a package.json containing opencv4nodejs variables
    // apply these variables to the process environment
    (0, env_1.applyEnvsFromPackageJson)();
    if ((0, env_1.isAutoBuildDisabled)()) {
        npmlog_1.default.info('install', 'OPENCV4NODEJS_DISABLE_AUTOBUILD is set');
        npmlog_1.default.info('install', 'skipping auto build...');
        return;
    }
    npmlog_1.default.info('install', 'if you want to use an own OpenCV installation set OPENCV4NODEJS_DISABLE_AUTOBUILD');
    // prevent rebuild on every install
    const autoBuildFile = ctxt.readAutoBuildFile();
    if (autoBuildFile) {
        npmlog_1.default.info('install', `found auto-build.json: ${ctxt.autoBuildFile}`);
        if (autoBuildFile.opencvVersion !== ctxt.opencvVersion) {
            npmlog_1.default.info('install', `auto build opencv version is ${autoBuildFile.opencvVersion}, but OPENCV4NODEJS_AUTOBUILD_OPENCV_VERSION=${ctxt.opencvVersion}`);
        }
        else if (autoBuildFile.autoBuildFlags !== (0, env_1.autoBuildFlags)()) {
            npmlog_1.default.info('install', `auto build flags are ${autoBuildFile.autoBuildFlags}, but OPENCV4NODEJS_AUTOBUILD_FLAGS=${(0, env_1.autoBuildFlags)()}`);
        }
        else {
            const hasLibs = checkInstalledLibs(ctxt, autoBuildFile);
            if (hasLibs) {
                npmlog_1.default.info('install', 'found all libraries');
                return;
            }
            else {
                npmlog_1.default.info('install', 'missing some libraries');
            }
        }
    }
    else {
        npmlog_1.default.info('install', `failed to find auto-build.json: ${ctxt.autoBuildFile}`);
    }
    npmlog_1.default.info('install', '');
    npmlog_1.default.info('install', 'running install script...');
    npmlog_1.default.info('install', '');
    npmlog_1.default.info('install', 'opencv version: %s', ctxt.opencvVersion);
    npmlog_1.default.info('install', 'with opencv contrib: %s', (0, env_1.isWithoutContrib)() ? 'no' : 'yes');
    npmlog_1.default.info('install', 'custom build flags: %s', (0, env_1.autoBuildFlags)());
    npmlog_1.default.info('install', '');
    try {
        await (0, utils_1.requireGit)();
        await (0, utils_1.requireCmake)();
        const ctxt = new BuildContext_1.BuildContext();
        await (0, setupOpencv_1.setupOpencv)(ctxt);
    }
    catch (err) {
        if (err.toString)
            npmlog_1.default.error('install', err.toString());
        else
            npmlog_1.default.error('install', JSON.stringify(err));
        process.exit(1);
    }
}
exports.install = install;
