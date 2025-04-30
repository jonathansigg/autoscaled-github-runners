#!/usr/bin/env node
import { Command } from "commander";
import { loadSetupCommands } from "./commands/setup.js";
import { loadConfig } from "./helper/config.js";
const program = new Command();
loadConfig().then((config) => {
	program
		.name("typescript-cli-tool")
		.description("A powerful CLI tool built with TypeScript")
		.version("1.0.0")
		.setOptionValue("config", config);

	loadSetupCommands(program);

	program.on("option:token", () => {
		console.log("Token set");
	});

	program.parse(process.argv);
});
