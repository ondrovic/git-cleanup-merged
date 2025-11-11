#!/usr/bin/env node
const GitCleanupTool = require("./index");

const tool = new GitCleanupTool();
const code = tool.parseArguments();
if (typeof code === "number") process.exit(code);
if (code === undefined) tool.run();
