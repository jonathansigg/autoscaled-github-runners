import { select } from '@inquirer/prompts';
import type { Command } from 'commander';
import { createSpinner } from 'nanospinner';
import { existsSync } from 'node:fs';
import {
	authenticateWithGitHub,
	downloadRunner,
	getLatestRunnerVersion,
} from '../helper/github.js';
import { error } from '../helper/message.js';
import { checkAndCreateDir, copyDir } from '../helper/utils.js';
import type { Config } from '../types/config.js';

export const loadRunnerCommands = (program: Command) => {
	program
		.command('runner')
		.description('Manage runners')
		.argument('[add]', 'Create a new runner')
		.argument('[delete]', 'Delete a runner')
		.action(async (add, remove, options) => {
			const config = program.getOptionValue('config') as Config;
			const { runnerPath, token } = config;

			if (!runnerPath) {
				throw error(
					'Runner path is not set. Please run setup command first. Please run `gh-runner setup` to set it up.',
				);
			}

			if (!token) {
				throw error(
					'GitHub personal access token is not set. Please run setup command first. Please run `gh-runner setup` to set it up.',
				);
			}

			if (add) {
				const runnerVersion = config?.runnerVersion ?? (await getLatestRunnerVersion());
				await addRunner(runnerPath, token, runnerVersion);
			}
		});
};

const addRunner = async (runnerPath: string, token: string, runnerVersion: string) => {
	let spinner = createSpinner('Fetching repositories').start();
	const octokit = await authenticateWithGitHub(token);
	const { data } = await octokit.repos.listForAuthenticatedUser();

	spinner.stop();

	const selectedRepo = await select({
		message: 'Select a repository to add a runner',
		pageSize: 10,
		choices: data.map((repo) => ({
			name: repo.full_name,
			value: repo.full_name,
		})),
	});

	const repoRunnerPath = `${runnerPath}/${selectedRepo}/runner`;
	const runnerDownloadPath = `${runnerPath}/downloads`;
	const runnerDownloadDir = `${runnerDownloadPath}/runner-v${runnerVersion}`;
	await checkAndCreateDir(repoRunnerPath);

	spinner = createSpinner('').start();
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

	spinner.update('Copy runner files');
	console.log(runnerDownloadDir);
	console.log(repoRunnerPath);
	copyDir(runnerDownloadDir, repoRunnerPath);

	spinner.success('Runner files extracted successfully.');
};
