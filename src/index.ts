#!/usr/bin/env node

//  $$$$$$\  $$\   $$\       $$$$$$$\  $$\   $$\ $$\   $$\ $$\   $$\ $$$$$$$$\ $$$$$$$\
// $$  __$$\ $$ |  $$ |      $$  __$$\ $$ |  $$ |$$$\  $$ |$$$\  $$ |$$  _____|$$  __$$\
// $$ /  \__|$$ |  $$ |      $$ |  $$ |$$ |  $$ |$$$$\ $$ |$$$$\ $$ |$$ |      $$ |  $$ |
// $$ |$$$$\ $$$$$$$$ |      $$$$$$$  |$$ |  $$ |$$ $$\$$ |$$ $$\$$ |$$$$$\    $$$$$$$  |
// $$ |\_$$ |$$  __$$ |      $$  __$$< $$ |  $$ |$$ \$$$$ |$$ \$$$$ |$$  __|   $$  __$$<
// $$ |  $$ |$$ |  $$ |      $$ |  $$ |$$ |  $$ |$$ |\$$$ |$$ |\$$$ |$$ |      $$ |  $$ |
// \$$$$$$  |$$ |  $$ |      $$ |  $$ |\$$$$$$  |$$ | \$$ |$$ | \$$ |$$$$$$$$\ $$ |  $$ |
//  \______/ \__|  \__|      \__|  \__| \______/ \__|  \__|\__|  \__|\________|\__|  \__|

import { Command } from 'commander';
import { loadCronCommands } from './commands/cron.js';
import { loadRunnerCommands } from './commands/runner.js';
import { loadSetupCommands } from './commands/setup.js';
import { loadConfig } from './helper/config.js';
const program = new Command();
loadConfig().then((config) => {
	program
		.name('github-runner-cli')
		.description('A powerful CLI tool for managing GitHub runners')
		.version('1.0.0')
		.setOptionValue('config', config);

	loadSetupCommands(program);
	loadRunnerCommands(program);
	loadCronCommands(program);

	program.parse(process.argv);
});
