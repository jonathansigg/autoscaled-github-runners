import { Octokit } from '@octokit/rest';
import fetch from 'node-fetch';
import { createWriteStream } from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import { checkAndCreateDir } from './utils.js';

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

export const getDownloadUrl = (version: string): { url: string; file: string } => {
	const platform = os.platform();
	const arch = os.arch();

	let osName: string;
	if (platform === 'linux') osName = 'linux';
	else if (platform === 'darwin') osName = 'osx';
	else if (platform === 'win32') osName = 'win';
	else throw new Error(`Unsupported platform: ${platform}`);

	let archName: string;
	if (arch === 'x64') archName = 'x64';
	else if (arch === 'arm64') archName = 'arm64';
	else throw new Error(`Unsupported arch: ${arch}`);

	const fileExt = osName === 'win' ? 'zip' : 'tar.gz';
	const file = `actions-runner-${osName}-${archName}-${version}.${fileExt}`;
	const url = `https://github.com/actions/runner/releases/download/v${version}/${file}`;

	return { url, file };
};

export const downloadRunner = async (
	url: string,
	dest: string,
	runnerFile: string,
): Promise<void> => {
	return new Promise((resolve, reject) => {
		checkAndCreateDir(dest).then(() => {
			const file = createWriteStream(`${dest}/${runnerFile}`);
			https.get(url, (response) => {
				response.pipe(file);

				file.on('finish', () => {
					file.close();
					resolve();
				});

				response.on('error', (err) => {
					file.close();
					reject(err);
				});
			});
		});
	});
};
