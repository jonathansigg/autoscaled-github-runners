import fs from 'fs-extra';
import { makeDirectory } from 'make-dir';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { normalize } from 'node:path';

export const checkAndCreateDir = async (dirPath: string) => {
	const path = normalize(dirPath);
	if (existsSync(path)) {
		return true;
	}

	await makeDirectory(path);
	return false;
};

export const copyDir = async (srcDir: string, destDir: string) => {
	const srcPath = normalize(srcDir);
	const destPath = normalize(destDir);
	if (!existsSync(srcPath)) {
		throw new Error(`Source directory does not exist: ${srcPath}`);
	}

	fs.copy(srcPath, destPath, { overwrite: true }, (err) => {
		if (err) throw new Error(`Error moving directory: ${err.message}`);
	});
};

export const getOsName = () => {
	const platform = os.platform();
	if (platform === 'linux') return 'linux';
	if (platform === 'darwin') return 'osx';
	if (platform === 'win32') return 'win';
	throw new Error(`Unsupported platform: ${platform}`);
};

export const getArchName = () => {
	const arch = os.arch();
	if (arch === 'x64') return 'x64';
	if (arch === 'arm64') return 'arm64';
	throw new Error(`Unsupported arch: ${arch}`);
};

export const removeDir = async (dirPath: string) => {
	const path = normalize(dirPath);
	if (existsSync(path)) {
		await fs.rm(path, { recursive: true, force: true });
	}
};
