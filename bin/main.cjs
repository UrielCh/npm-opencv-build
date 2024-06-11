#!/usr/bin/env node
const OpenCVBuilder = require("../cjs/src/OpenCVBuilder.js");
const builder = new OpenCVBuilder.OpenCVBuilder(process.argv);
void builder.install();
