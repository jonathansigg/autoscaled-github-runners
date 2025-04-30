import chalk from 'chalk';

export const success = (...message: unknown[]) => {
	console.log(chalk.green('✔'), ...message);
};

export const error = (...message: unknown[]) => {
	console.log(chalk.red('✖'), ...message);
};

export const info = (...message: unknown[]) => {
	console.log(chalk.blue('ℹ'), ...message);
};

export const warning = (...message: unknown[]) => {
	console.log(chalk.yellow('⚠'), ...message);
};

export const debug = (...message: unknown[]) => {
	console.log(chalk.gray('➤'), ...message);
};

export const message = (...message: unknown[]) => {
	console.log(...message);
};

export const breakLine = () => {
	console.log(chalk.gray('\n──────────────────────────────────────────────\n'));
};
