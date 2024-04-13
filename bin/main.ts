#!/usr/bin/env node
import * as OpenCVBuilder from "../src/OpenCVBuilder" 
//= require("../dist/cjs/OpenCVBuilder.js");
const builder = new OpenCVBuilder.OpenCVBuilder(process.argv);
void builder.install();