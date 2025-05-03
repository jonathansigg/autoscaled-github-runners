import { copy } from 'fs-extra';
import { mkdirp } from 'mkdirp';
import { existsSync } from 'node:fs';

export const checkAndCreateDir = async (dirPath: string) => {
	if (existsSync(dirPath)) {
		return true;
	}

	await mkdirp(dirPath);
	return false;
};

export const copyDir = async (srcDir: string, destDir: string) => {
	if (!existsSync(srcDir)) {
		throw new Error(`Source directory does not exist: ${srcDir}`);
	}

	copy(srcDir, destDir, { overwrite: true }, (err) => {
		if (err) throw new Error(`Error moving directory: ${err.message}`);
	});
};
