import { input } from '@inquirer/prompts';
import type { Command } from 'commander';
import { schedule, validate } from 'node-cron';
import { getConfig, saveConfig } from '../helper/config.js';
import { authenticateWithGitHub, startRunner } from '../helper/github.js';
import { error, message } from '../helper/message.js';
import { removeDir } from '../helper/utils.js';

export const loadCronCommands = (program: Command) => {
	program
		.command('cron')
		.description('Manage cron jobs for runners')
		.option('--add, -a', 'Add a new cron job')
		.option('--start, -s', 'Start cron job')
		.option('--labels, -l <labels>', 'Labels of the runner')
		// .option('--stop, -e', 'Stop cron job')
		.action(async (options) => {
			const config = getConfig(program);

			if (options?.add) {
				const cronExpression = await input({
					message: 'Enter the cron expression',
					default: config.cron ?? '* * * * *',
				});

				if (!validate(cronExpression)) {
					error('Invalid cron expression. Please provide a valid one.');
				}

				saveConfig('cron', cronExpression);
				return;
			}

			if (options?.start) {
				const cronExpression = config.cron;
				const repos = config.repos ?? [];
				const octokit = await authenticateWithGitHub(config.token);
				const checkIds: { owner: string; repo: string; run_id: number }[] = [];

				if (!repos.length) {
					throw error('No repositories found. Please add a repository first.');
				}

				const cronJob = schedule(
					cronExpression,
					async () => {
						let total = 0;
						let running_total = 0;
						for (const r of repos) {
							const [owner, repo] = r.split('/');
							if (!owner || !repo) {
								continue;
							}

							const { data: running } = await octokit.actions.listWorkflowRunsForRepo({
								owner,
								repo,
								status: 'in_progress',
								per_page: config.maxRunners,
							});

							running_total += running.total_count;
						}

						if (running_total > config.maxRunners) {
							console.log(`Total running jobs: ${running_total}`);
							return;
						}

						for (const r of repos) {
							const [owner, repo] = r.split('/');
							if (!owner || !repo) {
								continue;
							}
							const { data: queued } = await octokit.actions.listWorkflowRunsForRepo({
								owner,
								repo,
								status: 'queued',
								per_page: config.maxRunners,
							});

							if (!queued.workflow_runs.length) {
								continue;
							}

							for (const run of queued.workflow_runs) {
								const { id, repository } = run;
								const repoName = repository.full_name;
								const { data: check } = await octokit.actions.getWorkflowRun({
									owner,
									repo,
									run_id: id,
								});

								if (
									checkIds.find(
										(c) => c.owner === owner && c.repo === repoName && c.run_id === check.id,
									)
								) {
									continue;
								}

								await removeDir(`${config.runnerPath}/${owner}/${repo}/runner-${id}`);
								checkIds.push({
									owner,
									repo,
									run_id: id,
								});

								startRunner(config, {
									repo: repoName,
									name: `runner-${id}`,
									labels: options.labels,
								});
							}

							total += queued.total_count;
						}

						for (const ci of checkIds) {
							const { owner, repo, run_id } = ci;
							const { data: check } = await octokit.actions.getWorkflowRun({
								owner,
								repo,
								run_id,
							});

							const { status } = check;

							if (status === 'completed') {
								console.log(`Runner ${check.name} completed`);

								await removeDir(`${config.runnerPath}/${owner}/${repo}/runner-${run_id}`);
								const findIndx = checkIds.findIndex(
									(c) => c.owner === owner && c.repo === repo && c.run_id === run_id,
								);
								if (findIndx !== -1) {
									checkIds.splice(findIndx, 1);
								}
							}
						}

						console.log(`Total queued jobs: ${total}`);
					},
					{
						scheduled: true,
						name: 'gh-runner-cron',
						recoverMissedExecutions: false,
					},
				);
				cronJob.start();
				return;
			}

			message(
				'Please specify an action: --add',
				'For more information, run `gh-runner cron --help`',
			);
		});
};
