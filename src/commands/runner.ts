import type { Command } from 'commander';
import { createSpinner } from 'nanospinner';
import { existsSync } from 'node:fs';
import { normalize } from 'node:path';
import { getConfig, saveConfig } from '../helper/config.js';
import {
	downloadRunner,
	getLatestRunnerVersion,
	selectRepo,
	startRunner,
} from '../helper/github.js';
import { error } from '../helper/message.js';
import { checkAndCreateDir } from '../helper/utils.js';

export const loadRunnerCommands = (program: Command) => {
	program
		.command('add')
		.description('Create a new runner')
		.action(async () => {
			const config = getConfig(program);
			const { runnerPath, token } = config;

			const runnerVersion = config?.runnerVersion ?? (await getLatestRunnerVersion());
			const selectedRepo = await selectRepo({ token });
			const repoRunnerPath = normalize(`${runnerPath}/${selectedRepo}`);
			const runnerDownloadPath = normalize(`${runnerPath}/downloads`);

			await checkAndCreateDir(repoRunnerPath);

			const spinner = createSpinner().start();
			if (!existsSync(repoRunnerPath)) {
				spinner.update(`Downloading GitHub Actions Runner version ${runnerVersion}`);

				try {
					await downloadRunner(runnerVersion, runnerDownloadPath);
					spinner.success('Runner downloaded successfully.');
				} catch (err) {
					spinner.stop();
					throw error(err instanceof Error ? err.message : 'An unknown error occurred.');
				}
			}

			await saveConfig('repos', [selectedRepo]);
		});

	program
		.command('start')
		.description('Start the runner')
		.option('--repo, -r <repo>', 'Repository name')
		.option('--name, -n <name>', 'Runner name')
		.option('--labels, -l <labels>', 'Runner labels')
		.action(async (options) => {
			const config = getConfig(program);
			await startRunner(config, options);
		});
};
