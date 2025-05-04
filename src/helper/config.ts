import type { Command } from 'commander';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Config, ConfigKeys, ConfigRequired, ConfigSetOptions } from '../types/config.js';
import { error, success } from './message.js';
import { checkAndCreateDir } from './utils.js';

// Path to the config file in the user's home directory
export const configDirPath = path.join(os.homedir(), '.gh-runner');
export const configPath = path.join(configDirPath, 'config.json');

// Load existing config or initialize empty
export const loadConfig = async (): Promise<Config> => {
	await checkAndCreateDir(configDirPath);

	try {
		return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
	} catch {
		return {};
	}
};

// Save config back to file
export const saveConfig = async <K extends keyof Config>(
	key: K,
	value: Config[K],
	options?: ConfigSetOptions,
) => {
	const config = await loadConfig();

	if (Array.isArray(config[key]) && Array.isArray(value) && !options?.overwrite) {
		const newValue = value.filter((v) => !config[key]?.toString()?.includes(v));
		config[key].push(...newValue);
	} else {
		config[key] = value;
	}

	try {
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
	} catch (e) {
		error(`Failed to save config: ${key} = ${value}`);
	}
};

// Delete config
export const deleteConfig = async (key: ConfigKeys) => {
	const config = await loadConfig();
	delete config[key];
	try {
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
		success(`Config deleted: ${key}`);
	} catch {
		error(`Failed to delete config: ${key}`);
	}
};

export const checkConfig = (config: Config, check?: ConfigKeys[]) => {
	const { runnerPath, token } = config;

	if (!runnerPath && (!check?.length || check?.includes('runnerPath'))) {
		throw error(
			'Runner path is not set. Please run setup command first. Please run `gh-runner setup` to set it up.',
		);
	}

	if (!token && (!check?.length || check?.includes('token'))) {
		throw error(
			'GitHub personal access token is not set. Please run setup command first. Please run `gh-runner setup` to set it up.',
		);
	}
};

export const getConfig = (program: Command, keys?: ConfigKeys[]): ConfigRequired => {
	const config = program.getOptionValue('config') as Config;
	checkConfig(config, keys);
	return config as ConfigRequired;
};
