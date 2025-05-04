import { input, number } from '@inquirer/prompts';
import type { Command } from 'commander';
import { createSpinner } from 'nanospinner';
import path from 'node:path';
import { getConfig, saveConfig } from '../helper/config.js';
import { downloadRunner, getLatestRunnerVersion } from '../helper/github.js';
import { breakLine, error, info, message } from '../helper/message.js';

export const loadSetupCommands = (program: Command) => {
	program
		.command('setup')
		.description('Setup the application')
		.option('--skip-config, -s', 'Skip configuration')
		.option('--runner-path, -p <path>', 'Path to the runners')
		.option('--token, -t <token>', 'GitHub personal access token')
		.action(async (options) => {
			const config = getConfig(program);

			// set default values
			const defaults = {
				runnerPath: options?.runnerPath ?? config.runnerPath ?? `${path.resolve()}/runners`,
				token: options?.token ?? config.token,
				maxRunners: config.maxRunners ?? config.maxRunners ?? 8,
			};

			message('Welcome to autoscaled runner setup!');
			info('This will help you configure the application.');

			let { runnerPath, token } = defaults;

			if (!options?.skipConfig) {
				if (!options?.token) {
					token = await input({
						message: 'Enter your GitHub personal access token',
						default: defaults.token,
					});

					if (!token) {
						throw error(
							'GitHub personal access token is required. Please provide it using --token or set GITHUB_TOKEN environment variable.',
						);
					}

					await saveConfig('token', token);
				}

				if (!options?.runnerPath) {
					runnerPath = await input({
						message: 'Enter the path to your runner',
						default: defaults.runnerPath,
					});

					if (!runnerPath) {
						throw error('Runner path is required. Please provide it.');
					}

					await saveConfig('runnerPath', runnerPath);
				}

				if (!options?.maxRunners) {
					const maxRunners = await number({
						message: 'Enter the maximum number of runners',
						default: defaults.maxRunners,
						validate: (value) => {
							if (value === undefined) {
								return 'Maximum number of runners is required. Please provide it.';
							}
							if (value < 1) {
								return 'Number of runners must be at least 1.';
							}
							return true;
						},
					});

					await saveConfig('maxRunners', maxRunners);
				}

				if (options) {
					breakLine();
				}
			}

			const spinner = createSpinner('Download runner from github').start();
			message('\n');
			const runnerVersion = config?.runnerVersion ?? (await getLatestRunnerVersion());
			spinner.stop();

			try {
				await downloadRunner(runnerVersion, `${runnerPath}/downloads`);
			} catch (err) {
				spinner.stop();
				throw error(err instanceof Error ? err.message : 'An unknown error occurred.');
			}

			spinner.stop();
		});
};
