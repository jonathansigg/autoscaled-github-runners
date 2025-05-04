import { input, select } from '@inquirer/prompts';
import type { Command } from 'commander';
import { createSpinner } from 'nanospinner';
import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { normalize } from 'node:path';
import { getConfig, saveConfig } from '../helper/config.js';
import {
	authenticateWithGitHub,
	downloadRunner,
	getLatestRunnerVersion,
} from '../helper/github.js';
import { error, message } from '../helper/message.js';
import { checkAndCreateDir, copyDir, getArchName, getOsName } from '../helper/utils.js';

export const loadRunnerCommands = (program: Command) => {
	program
		.command('add')
		.description('Create a new runner')
		.option('--name, -n <name>', 'Name of the runner')
		.option('--labels, -l <labels>', 'Labels of the runner')
		.action(async (options) => {
			const config = getConfig(program);
			const { runnerPath, token } = config;

			const runnerVersion = config?.runnerVersion ?? (await getLatestRunnerVersion());
			await addRunner(runnerPath, token, runnerVersion, options);
		});

	program
		.command('start')
		.description('Start the runner')
		.option('--repo, -r <repo>', 'Repository name')
		.action(async (options) => {
			const config = getConfig(program);
			const { runnerPath, repos } = config;

			startRunner(runnerPath, repos, options);
		});
};

const selectRepo = async (token: string) => {
	const spinner = createSpinner('Fetching repositories').start();
	const octokit = await authenticateWithGitHub(token);
	const { data } = await octokit.repos.listForAuthenticatedUser();

	spinner.stop();

	return select({
		message: 'Select a repository to add a runner',
		pageSize: 10,
		choices: data.map((repo) => ({
			name: repo.full_name,
			value: repo.full_name,
		})),
	});
};

const startRunner = async (runnerPath: string, repos: string[], options: { repo: string }) => {
	const selectedRepo =
		options?.repo ??
		(await select({
			message: 'Select a repository to start a runner',
			pageSize: 10,
			choices: repos.map((repo) => ({
				name: repo,
				value: repo,
			})),
		}));

	const repoRunnerPath = `${runnerPath}/${selectedRepo}`;
	const startScript = getOsName() === 'win' ? 'run.cmd' : 'run.sh';
	exec(startScript, { cwd: repoRunnerPath }, (err, stdout, stderr) => {
		if (err) {
			error(err.message);
			return;
		}

		message(stdout);
	});
};

const addRunner = async (
	runnerPath: string,
	token: string,
	runnerVersion: string,
	options: { name?: string; runnergroup?: string; labels?: string },
) => {
	const selectedRepo = await selectRepo(token);
	const repoRunnerPath = normalize(`${runnerPath}/${selectedRepo}`);
	const runnerDownloadPath = normalize(`${runnerPath}/downloads`);
	const runnerDownloadDir = normalize(`${runnerDownloadPath}/runner-v${runnerVersion}`);
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

	spinner.update('Copy runner files');
	copyDir(runnerDownloadDir, repoRunnerPath);
	spinner.success('Runner files extracted successfully.');
	spinner.stop();

	const [owner, repo] = selectedRepo.split('/');

	if (!owner || !repo) {
		throw error('Invalid repository name. Please select a valid repository.');
	}

	const octokit = await authenticateWithGitHub(token);
	// const { data } = await octokit.repos.get({ owner, repo });
	// const isOrg = data.owner.type === 'Organization';

	// const runnerToken = isOrg
	// 	? await octokit.actions.createRegistrationTokenForOrg({ org: owner }) //./config.cmd --url https://github.com/admin-poker --token ADM4I4SQTN6BEXTCC3IEVWTIC4ZHW
	// 	: await octokit.actions.createRegistrationTokenForRepo({ owner, repo });

	const { data: runnerTokenData } = await octokit.actions.createRegistrationTokenForRepo({
		owner,
		repo,
	});

	const runnerName =
		options.name ??
		(await input({
			message: 'Enter the name of the runner',
			default: `${getOsName()}-${getArchName()}`,
			validate: (input) => {
				if (input.length < 1) {
					return 'Runner name cannot be empty.';
				}
				if (input.includes(' ')) {
					return 'Runner name cannot contain spaces.';
				}
				return true;
			},
		}));

	const runnerLabels =
		options.labels ??
		(await input({
			message: 'Enter the labels of the runner',
			default: `${getOsName()}-${getArchName()}`,
			validate: (input) => {
				if (input.length < 1) {
					return 'Runner labels cannot be empty.';
				}
				if (input.includes(' ')) {
					return 'Runner labels cannot contain spaces.';
				}
				return true;
			},
		}));

	// const runnerGroup =
	// 	options.runnergroup ??
	// 	(await input({
	// 		message: 'Enter the runnergroup of the runner',
	// 		default: `${getOsName()}-${owner}`,
	// 		validate: (input) => {
	// 			if (input.length < 1) {
	// 				return 'Runner runnergroup cannot be empty.';
	// 			}
	// 			if (input.includes(' ')) {
	// 				return 'Runner runnergroup cannot contain spaces.';
	// 			}
	// 			return true;
	// 		},
	// 	}));

	const scriptFile = getOsName() === 'win' ? 'config.cmd' : 'config.sh';
	const configScript = `${scriptFile} --url https://github.com/${selectedRepo} --token ${runnerTokenData.token} --name ${runnerName} --labels ${runnerLabels} --ephemeral --unattended`;
	exec(configScript, { cwd: repoRunnerPath }, (err, stdout, stderr) => {
		if (err) {
			error(err.message);
			return;
		}
	});

	await saveConfig('repos', [selectedRepo]);
};
