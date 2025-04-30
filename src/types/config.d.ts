export type Config = {
	token?: string;
	runnerPath?: string;
	runnerVersion?: string;
};
export type ConfigKeys = keyof Config;
export type ConfigValues = Config[keyof Config];
