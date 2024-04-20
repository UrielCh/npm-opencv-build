import * as utils from './utils';
import type { AutoBuildFile } from './types';
import fs from 'fs';
import { getLibsFactory } from './getLibsFactory';
import { SetupOpencv } from './setupOpencv';
import { Constant } from './constants';
import OpenCVBuildEnv from './OpenCVBuildEnv';
import { args2Option, genHelp, OpenCVBuildEnvParams, OPENCV_PATHS_ENV } from './misc';
import npmlog from 'npmlog';

export class OpenCVBuilder {
  public readonly constant: Constant;
  public readonly getLibs: getLibsFactory;
  public readonly env: OpenCVBuildEnv;

  constructor(opts?: OpenCVBuildEnv | OpenCVBuildEnvParams | string[]) {
    if (Array.isArray(opts)) {
      opts = args2Option(opts);
      if (opts.verbose) {
        npmlog.level === 'verbose';
      }
      if (opts.extra && (opts.extra.help || opts.extra.h)) {
        console.log('npm-opencv-build usage:')
        console.log(genHelp())
        process.exit(1);
      }
    }
    if (opts instanceof OpenCVBuildEnv) {
      this.env = opts
    } else {
      this.env = new OpenCVBuildEnv(opts)
    }
    if (!this.env.prebuild)
      OpenCVBuildEnv.log('info', 'init', `${utils.highlight("Workdir")} will be: ${utils.formatNumber("%s")}`, this.env.opencvRoot)
    this.constant = new Constant(this)
    this.getLibs = new getLibsFactory(this)
  }

  private checkInstalledLibs(autoBuildFile: AutoBuildFile): boolean {
    let hasLibs = true

    OpenCVBuildEnv.log('info', 'install', 'checking for opencv libraries')

    if (!fs.existsSync(this.env.opencvLibDir)) {
      OpenCVBuildEnv.log('info', 'install', 'library dir does not exist:', this.env.opencvLibDir)
      return false
    }
    const installedLibs = this.getLibs.getLibs()

    autoBuildFile.modules.forEach(({ opencvModule, libPath }) => {
      if (!libPath) {
        OpenCVBuildEnv.log('info', 'install', '%s: %s', opencvModule, 'ignored')
        return
      }
      const foundLib = installedLibs.find(lib => lib.opencvModule === opencvModule)
      hasLibs = hasLibs && !!foundLib
      OpenCVBuildEnv.log('info', 'install', `lib ${utils.formatNumber("%s")}: ${utils.light("%s")}`, opencvModule, foundLib ? foundLib.libPath : 'not found')
    })
    return hasLibs
  }

  async install(): Promise<void> {
    let time = Date.now();
    // if project directory has a package.json containing opencv4nodejs variables
    // apply these variables to the process environment
    // this.env.applyEnvsFromPackageJson()

    if (this.env.isAutoBuildDisabled) {
      OpenCVBuildEnv.log('info', 'install', `${utils.highlight('OPENCV4NODEJS_DISABLE_AUTOBUILD')} is set skipping auto build...`)
      const setup = new SetupOpencv(this);
      setup.writeAutoBuildFile(true);
      setup.linkBuild();
      return
    }
    OpenCVBuildEnv.log('info', 'install', `if you want to use an own OpenCV build set ${utils.highlight('OPENCV4NODEJS_DISABLE_AUTOBUILD')} to 1, and fill ${OPENCV_PATHS_ENV.map(utils.highlight).join(', ')} environement variables`);
    // prevent rebuild on every install
    const autoBuildFile = this.env.readAutoBuildFile()
    if (autoBuildFile) {
      OpenCVBuildEnv.log('info', 'install', `found previous build summery auto-build.json: ${utils.highlight(this.env.autoBuildFile)}`)

      if (autoBuildFile.opencvVersion !== this.env.opencvVersion) {
        // can no longer occure with this version of opencv4nodejs-builder
        OpenCVBuildEnv.log('info', 'install', `auto build opencv version is ${autoBuildFile.opencvVersion}, but AUTOBUILD_OPENCV_VERSION=${this.env.opencvVersion}, Will rebuild`)
      } else if (autoBuildFile.autoBuildFlags !== this.env.autoBuildFlags) {
        // should no longer occure since -MD5(autoBuildFlags) is append to build path
        OpenCVBuildEnv.log('info', 'install', `auto build flags are ${autoBuildFile.autoBuildFlags}, but AUTOBUILD_FLAGS is ${this.env.autoBuildFlags}, Will rebuild`)
      } else {
        const hasLibs = this.checkInstalledLibs(autoBuildFile)
        if (hasLibs) {
          OpenCVBuildEnv.log('info', 'install', `all libraries are installed in ${utils.highlight(this.env.opencvLibDir)} => ${utils.highlight('Skip building')}`)
          return;
        } else {
          OpenCVBuildEnv.log('info', 'install', 'missing some libraries')
        }
      }
    } else {
      // OpenCVBuildEnv.log('info', 'install', `failed to find auto-build.json: ${this.env.autoBuildFile}`)
    }

    OpenCVBuildEnv.log('info', 'install', '')
    OpenCVBuildEnv.log('info', 'install', 'running install script...')
    OpenCVBuildEnv.log('info', 'install', '')
    OpenCVBuildEnv.log('info', 'install', `opencv version: ${utils.formatNumber('%s')}`, this.env.opencvVersion)
    OpenCVBuildEnv.log('info', 'install', `with opencv contrib: ${utils.formatNumber('%s')}`, this.env.isWithoutContrib ? 'no' : 'yes')
    OpenCVBuildEnv.log('info', 'install', `custom build flags: ${utils.formatNumber('%s')}`, this.env.autoBuildFlags || '< none >')
    OpenCVBuildEnv.log('info', 'install', '')

    try {
      await utils.requireGit()
      await utils.requireCmake()
      const setup = new SetupOpencv(this);
      await setup.start()
      time = (Date.now() - time);
      const date = new Date(time);
      const timeString = date.toISOString().substring(11, 19);
      OpenCVBuildEnv.log('info', 'install', `Total Build Time: ${utils.formatNumber(timeString)}`)
    } catch (err) {
    if (err instanceof Error) {
      OpenCVBuildEnv.log('error', 'install', err.toString())
    } else {
      OpenCVBuildEnv.log('error', 'install', JSON.stringify(err))
    }
      process.exit(1)
    }
  }
}

export default OpenCVBuilder;
