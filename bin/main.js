#!/usr/bin/env node
const OpenCVBuilder = require("../dist/cjs/OpenCVBuilder.js");
const builder = new OpenCVBuilder.OpenCVBuilder(process.argv);
void builder.install();
