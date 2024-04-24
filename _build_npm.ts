// dnt deps can not be moved to dev_deps.ts
import { build, emptyDir, type PackageJson } from "@deno/dnt";
import { pc } from "./deps.ts";

export async function buildDnt() {
  let version = Deno.args[0];
  const GITHUB_REF = Deno.env.get("GITHUB_REF");
  const PKG_VERSION = Deno.env.get("PKG_VERSION");

  if (!version) {
    if (PKG_VERSION) {
      console.log(`NPM_VERSION values is "${pc.green(PKG_VERSION)}"`);
      version = PKG_VERSION;
    } else if (GITHUB_REF) {
      // drop the ref/tag/ and the v prefix
      version = GITHUB_REF.replace(/^.+\/[vV]?/g, "");
      console.log(
        `GITHUB_REF values is ${
          pc.green(
            GITHUB_REF,
          )
        } will be used as version: "${pc.green(version)}"`,
      );
    }
  }

  if (!version) {
    console.error("Missing version number");
    console.error("usage: deno run -A _build_npm.ts 0.0.0");
    Deno.exit(-1);
  }
  // allow only semver string
  if (!version.match(/[\d]+\.[\d]+\.[\d]+/)) {
    console.error(
      `version number ${
        pc.green(
          version,
        )
      } do not match Semantic Versioning syntax ${
        pc.green(
          "major.minor.path",
        )
      }`,
    );
    Deno.exit(-1);
  }
  const prj = "npm-opencv-build";
  const packageJson: PackageJson = {
    // package.json properties
    name: "@u4/opencv-build",
    author: "Uriel Chemouni <uchemouni@gmail.com> (https://uriel.deno.dev/)",
    license: "MIT",
    funding: `https://github.com/UrielCh/${prj}?sponsor=1`,
    contributors: [
      "Uriel Chemouni <uchemouni@gmail.com> (https://uriel.ovh/)",
      "justadudewhohacks (https://github.com/justadudewhohacks)",
    ],
    description:
      "Script to auto build recent OpenCV + contrib via npm 2023 Edition",
    keywords: [
      "opencv",
      "build",
      "opencv4nodejs",
    ],
    homepage: `https://github.com/UrielCh/${prj}`,
    version,
    repository: {
      type: "git",
      url: `git+https://github.com/UrielCh/${prj}.git`,
    },
    bugs: {
      url: `https://github.com/UrielCh/${prj}/issues`,
    },
    bin: {
      // "opencv-build-npm": "main.js",
    },
    "engine-strict": {
      node: ">=18",
    },
    devDependencies: {
      "@types/npmlog": "^7.0.0",
    },
  };
  await emptyDir("./npm");

  await build({
    entryPoints: ["./mod.ts"], // , "main.ts"
    outDir: "./npm",
    test: true,
    declaration: "separate",
    shims: {
      // see JS docs for overview and more options
      deno: true,
      // webSocket: true,
      // undici: true,
      custom: [
        //   {
        //     package: {
        //       name: "stream/web",
        //     },
        //     globalNames: ["ReadableStream", "TransformStream"],
        //   },
        //   {
        //     globalNames: [{ name: "MessageEvent", typeOnly: true }],
        //     package: {
        //       name: "ws",
        //     },
        //   }
      ],
    },
    compilerOptions: {
      lib: ["ESNext"],
    },
    package: packageJson,
    mappings: {
      // "https://deno.land/x/logger@v1.1.3/logger.ts": {
      //   name: "@denodnt/logger",
      //   version: "1.1.3",
      //   peerDependency: false,
      // },
    },
  });

  // post build steps
  console.log("extra build steps");
  console.log("cwd:", Deno.cwd());
  Deno.copyFileSync("CHANGELOG.md", "npm/CHANGELOG");
  // Deno.copyFileSync("LICENSE", "npm/LICENSE");
  let readme = "";
  readme = Deno.readTextFileSync("README.md");
  // readme = readme.replaceAll(
  //   "https://deno.land/x/midjourney_discord_api/mod.ts",
  //   "midjourney-discord-api",
  // );
  Deno.writeTextFileSync("npm/README.md", readme);
  // Deno.copyFileSync("README.md", "npm/README.md");
  // Deno.mkdirSync("npm/types/types");
  // const files = Deno.readDirSync("types");
  // for (const file of files) {
  //   if (!file.isFile)
  //     continue;
  //   let text = Deno.readTextFileSync(`types/${file.name}`)
  //   text = text.replace(/.d.ts(["'])/g, "$1");
  //   Deno.writeTextFileSync(`npm/types/types/${file.name}`, text);
  //   console.log(`copy types/${file.name} to npm/types/types/${file.name}`)
  // }
  //Deno.copyFileSync("types", "npm/types");
}

if (import.meta.main) {
  buildDnt();
}
