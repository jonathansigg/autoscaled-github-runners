import { confirm, input, select } from '@inquirer/prompts';
import { Octokit } from '@octokit/rest';
import AdmZip from 'adm-zip';
import axios from 'axios';
import fs from 'fs-extra';
import { createSpinner } from 'nanospinner';
import fetch from 'node-fetch';
import { exec } from 'node:child_process';
import { error } from 'node:console';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path, { normalize } from 'node:path';
import { x } from 'tar';
import type { ConfigRequired } from '../types/config.js';
import { checkAndCreateDir, copyDir, getArchName, getOsName } from './utils.js';

const fallbackVersion = '2.316.0'; // Fallback version if latest version cannot be fetched

export const authenticateWithGitHub = async (token: string): Promise<Octokit> => {
	const octokit = new Octokit({
		auth: token,
	});

	try {
		await octokit.users.getAuthenticated();
		return octokit;
	} catch (error) {
		throw new Error('Failed to authenticate with GitHub API. Please check your token.');
	}
};

export const getLatestRunnerVersion = async (): Promise<string> => {
	const res = await fetch('https://api.github.com/repos/actions/runner/releases/latest');
	if (!res.ok) return fallbackVersion; // Fallback to a known version if the request fails
	const json = (await res.json()) as any;
	return json.tag_name.replace(/^v/, ''); // e.g. v2.316.0 → 2.316.0
};

export const getDownloadUrl = (version: string): string => {
	const platform = os.platform();

	const osName = getOsName();
	const archName = getArchName();

	const fileExt = osName === 'win' ? 'zip' : 'tar.gz';
	const file = `actions-runner-${osName}-${archName}-${version}.${fileExt}`;
	const url = `https://github.com/actions/runner/releases/download/v${version}/${file}`;

	return url;
};

export const downloadRunner = async (
	version: string,
	dest: string,
): Promise<{ download: boolean }> => {
	const extractDir = path.join(dest, `runner-v${version}`);
	const url = getDownloadUrl(version);
	const exists = await checkAndCreateDir(extractDir);

	if (exists) {
		const confirmDownload = await confirm({
			message: `Runner v${version} already exists. Do you want to download the runner again?`,
			default: true,
		});

		if (!confirmDownload) {
			return new Promise((resolve) => resolve({ download: false }));
		}

		fs.removeSync(extractDir);
	}
	mkdirSync(extractDir, { recursive: true });

	if (getOsName() === 'win') {
		try {
			const res = await axios.get(url, {
				headers: {
					'Content-Type': 'application/zip',
				},
				responseType: 'arraybuffer',
			});
			const zip = new AdmZip(res.data);
			zip.extractAllTo(extractDir, true);
		} catch (e) {
			console.log(e);
		}
		return new Promise((resolve) => resolve({ download: true }));
	}

	const response = await axios({
		method: 'get',
		url,
		responseType: 'stream',
	});

	return new Promise((resolve, reject) => {
		response.data
			.pipe(x({ cwd: extractDir }))
			.on('finish', () => {
				resolve({ download: true });
			})
			.on('error', (err: unknown) => {
				reject(err);
			});
	});
};

export const selectRepo = async (options: { repos?: string[]; token?: string }) => {
	let repos = options?.repos?.length ? options?.repos : [];

	if (!options?.repos && options?.token) {
		const spinner = createSpinner('Fetching repositories').start();
		const octokit = await authenticateWithGitHub(options.token);
		const { data } = await octokit.repos.listForAuthenticatedUser();
		repos = data.map((repo) => repo.full_name);
		spinner.stop();
	}

	return select({
		message: 'Select a repository to add a runner',
		pageSize: 10,
		choices: repos.map((repo) => ({
			name: repo,
			value: repo,
		})),
	});
};

export const startRunner = async (
	config: ConfigRequired,
	options?: { repo?: string; name?: string; labels?: string },
) => {
	const { runnerPath, repos, token } = config;
	const runnerVersion = config?.runnerVersion ?? (await getLatestRunnerVersion());
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
	const runnerName =
		options?.name ??
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
		options?.labels ??
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
	const repoRunnerPath = normalize(`${runnerPath}/${selectedRepo}/${runnerName}`);
	const runnerDownloadPath = normalize(`${runnerPath}/downloads`);
	const runnerDownloadDir = normalize(`${runnerDownloadPath}/runner-v${runnerVersion}`);

	if (fs.existsSync(repoRunnerPath)) {
		return;
	}

	copyDir(runnerDownloadDir, repoRunnerPath);

	const [owner, repo] = selectedRepo.split('/');

	if (!owner || !repo) {
		throw error('Invalid repository name. Please select a valid repository.');
	}

	const octokit = await authenticateWithGitHub(token);

	const { data: runnerTokenData } = await octokit.actions.createRegistrationTokenForRepo({
		owner,
		repo,
	});

	const scriptFile = getOsName() === 'win' ? 'config.cmd' : 'config.sh';
	const configScript = `${scriptFile} --url https://github.com/${selectedRepo} --token ${runnerTokenData.token} --name ${runnerName} --labels ${runnerLabels} --ephemeral --unattended`;
	const startScript = getOsName() === 'win' ? 'run.cmd' : 'run.sh';

	exec(`${configScript} && ${startScript}`, { cwd: repoRunnerPath }, (err, stdout, stderr) => {
		if (err) {
			error(err.message);
			return;
		}
	});
};
