import { confirm, select } from '@inquirer/prompts';
import { Octokit } from '@octokit/rest';
import AdmZip from 'adm-zip';
import axios from 'axios';
import fs from 'fs-extra';
import { createSpinner } from 'nanospinner';
import fetch from 'node-fetch';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { x } from 'tar';
import { checkAndCreateDir, getArchName, getOsName } from './utils.js';

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
