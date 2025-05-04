export type Config = {
	token?: string;
	runnerPath?: string;
	runnerVersion?: string;
	repos?: string[];
	maxRunners?: number;
	cron?: string;
};

export type ConfigSetOptions = {
	overwrite?: boolean;
};

export type ConfigKeys = keyof Config;
export type ConfigValues = Config[keyof Config];
export type ConfigRequired = Required<Config>;
export type ConfigIsRequired = 'required' | false;
