import { mkdirp } from 'mkdirp';
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { message } from './message.js';

export const checkAndCreateDir = async (dirPath: string) => {
	try {
		readdirSync(dirname(dirPath), {
			recursive: true,
		});
	} catch {
		message(`Creating missing directory: ${dirPath}`);
		await mkdirp(dirPath);
	}
};
