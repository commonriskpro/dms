#!/usr/bin/env node
const path = require("path");
const { execSync } = require("child_process");

const rootNodeModules = path.resolve(__dirname, "..", "..", "node_modules");
const env = { ...process.env, NODE_PATH: rootNodeModules };

execSync("npx tsc", { stdio: "inherit", env });