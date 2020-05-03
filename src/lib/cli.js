'use strict';

const _ = require('lodash');
const path = require('path');
const columnify = require('columnify');
const chalk = require('chalk');
const yargs = require('yargs');
const EOL = require('os').EOL;
const prompts = require('prompts');
const execa = require('execa');
const updateNotifier = require('update-notifier');
const envPaths = require('env-paths');
const fs = require('fs-extra');
const crypto = require('crypto');

const pkg = require('../../package.json');

const DEFAULT_RESULTS_LIMIT = 20;
const currentWorkingDir = process.cwd();

/**
 * Define command line arguments
 */
const args = yargs
  .example('rr [options]', 'Run interactive scripts runner')
  .example('rrr', 'Rerun last executed script (same as `rr -r`)')
  .option('r', {
    type: 'boolean',
    alias: 'rerun',
    describe: `Rerun the last executed script`,
  })
  .option('a', {
    type: 'boolean',
    alias: 'all',
    describe: `Show all available scripts instead of just ${DEFAULT_RESULTS_LIMIT}`,
  })
  .option('c', {
    type: 'string',
    alias: 'config',
    describe: `Path to custom package.json, relative to current working dir`,
  })
  // For debugging purposes
  .option('cacheFile', {
    type: 'boolean',
    alias: 'cacheFile',
    describe: `Show the cache file path for the current project`,
    hidden: true,
  })
  .help('h')
  .alias('h', 'help')
  .group(['help'], 'General:')
  // Allow setting CLI options with environment variables:
  // https://github.com/yargs/yargs/blob/master/docs/api.md#envprefix
  .env('RUNRUN_CLI')
  .wrap(100).argv;

const userConfigPath = args.config || 'package.json';
const userConfigFullPath = path.resolve(currentWorkingDir, userConfigPath);
const userConfig = require(userConfigFullPath);

/**
 * High resolution timing API
 *
 * @returns {number} High resolution timestamp
 */
function time() {
  const time = process.hrtime();

  return time[0] * 1e3 + time[1] / 1e6;
}

/**
 * Handle promise rejections and errors
 */
function handleError(err) {
  let errMsg = err;

  if (err instanceof Object) {
    errMsg = err.message || err.error || JSON.stringify(err);
  }

  printColumns(chalk.red('Error: ' + errMsg));
  printColumns(
    chalk.white(
      `If you can't settle this, please open an issue at:${EOL}` +
        chalk.cyan(pkg.bugs.url)
    )
  );
  process.exit(1);
}

/**
 * Print to stdout
 *
 * @see [columnify](https://github.com/timoxley/columnify)
 *
 * @param {string} heading
 * @param {Array}  [data]
 */
function printColumns(heading, data) {
  const columns = columnify(data, {});
  const spacer = EOL + EOL;

  process.stdout.write(heading);
  process.stdout.write(spacer);

  if (columns) {
    process.stdout.write(columns);
    process.stdout.write(spacer);
  }
}

/**
 * Print a nice header
 */
function printBegin() {
  printColumns(chalk.whiteBright.dim(`runrun-cli: v${pkg.version}`));
}

/**
 * Print how long it took the tool to execute
 */
function printTimingAndExit(startTime) {
  const execTime = time() - startTime;

  printColumns(
    chalk.green(`${EOL}runrun-cli: Finished in ${execTime.toFixed()}ms`)
  );
  process.exit(0);
}

/**
 * Check for package update
 * https://github.com/yeoman/update-notifier
 */
function notifyOnUpdate() {
  const notifier = updateNotifier({
    pkg: {
      name: pkg.name,
      version: pkg.version,
    },
    // How often to check for updates (1 day)
    updateCheckInterval: 1000 * 60 * 60 * 24,
    // By default does not notify when running as an npm script
    shouldNotifyInNpmScript: true,
  });

  notifier.notify({ defer: false });
}

/**
 * Custom filtering logic, for better matching
 *
 * @param {string} input What the user typed so far
 * @param {Array}  choices All available choices
 */
function suggestByTitle(input, choices) {
  return Promise.resolve(
    choices.filter(item => {
      const inputSplit = input.split(/\s/);

      return inputSplit.every(subInput => item.title.includes(subInput));
    })
  );
}

/**
 * Cache the executed script name so we could re-run it using `rrr`.
 */
function cacheTargetScript(cacheFilePath, targetScript) {
  return fs.outputJson(cacheFilePath, {
    cwd: currentWorkingDir,
    lastTargetScript: targetScript,
  });
}

/**
 * Get the path to the cache file for the current working dir.
 *
 * @see
 * https://medium.com/@chris_72272/what-is-the-fastest-node-js-hashing-algorithm-c15c1a0e164e
 */
function getCacheFilePath() {
  // e.g. On macOS: `/Users/user_name/Library/Preferences/runrun-cli-nodejs`
  const osConfigDirPath = envPaths(pkg.name).config;
  // e.g. `CZNTqAaVkXSOJ9ywDrnElP1E1Iw=`
  const cwdHash = crypto
    .createHash('sha1')
    .update(currentWorkingDir)
    .digest('base64');
  // e.g. `my-project.CZNTqAaVkXSOJ9ywDrnElP1E1Iw=.json`
  const filename = `${path.basename(currentWorkingDir)}.${cwdHash}.json`;

  return path.join(osConfigDirPath, filename);
}

function getLastTargetScriptName(cacheFilePath, scripts) {
  try {
    const lastTargetScript = require(cacheFilePath).lastTargetScript;

    if (!scripts[lastTargetScript]) {
      printColumns(
        chalk.yellow(
          `The script '${lastTargetScript}' no longer exists in:${EOL}` +
            chalk.cyan(userConfigFullPath) +
            `${EOL}Please choose a script to run...`
        )
      );

      return null;
    }

    return lastTargetScript;
  } catch (error) {
    printColumns(
      chalk.yellow(
        `No cache found for this project.${EOL}` +
          `Please choose a script to run...`
      )
    );

    return null;
  }
}

/**
 * Run an interactive autocomplete for the user to choose a script to execute.
 *
 * @see
 * [prompts](https://github.com/terkelg/prompts)
 *
 * @param {Array} scripts List of `scripts` from a `package.json` file
 */
async function promptUser(scripts) {
  const responses = await prompts([
    {
      type: 'autocomplete',
      name: 'script',
      message: 'Choose or type the npm script to run:',
      choices: _.map(scripts, (command, scriptName) => ({
        title: scriptName,
        value: scriptName,
      })),
      suggest: suggestByTitle,
      limit: args.all ? _.keys(scripts).length : DEFAULT_RESULTS_LIMIT,
    },
  ]);

  if (_.isEmpty(responses)) {
    printColumns('Aborting...');

    return process.exit();
  }

  return responses.script;
}

/**
 * @see
 * [execa options](https://github.com/sindresorhus/execa#options)
 *
 * @param {string} targetScriptName The npm script to run
 */
function runNpmScript(targetScriptName) {
  return execa.command(`npm run ${targetScriptName}`, {
    // Needed as the user can provide a custom config path
    cwd: path.dirname(userConfigFullPath),
    stdio: 'inherit',
  });
}

function validateScripts(scripts) {
  if (!scripts) {
    printColumns(
      chalk.red(
        `There are no npm scripts found in:${EOL}` +
          chalk.cyan(userConfigFullPath)
      )
    );
    process.exit(0);
  }
}

/**
 * Hit it
 */
async function init() {
  printBegin();
  notifyOnUpdate();

  const { scripts } = userConfig;

  validateScripts(scripts);

  let targetScript;
  const cacheFilePath = getCacheFilePath();

  // For debugging purposes
  if (args.cacheFile) {
    printColumns(chalk.cyan(cacheFilePath));
  }

  if (args.rerun) {
    targetScript = getLastTargetScriptName(cacheFilePath, scripts);
  }

  targetScript = targetScript || (await promptUser(scripts));

  const startTime = time();

  // Cache the chosen script so we could re-run it with `rrr` later.
  // Must happen before we run the script, as the user can exit with Ctrl + C.
  cacheTargetScript(cacheFilePath, targetScript);

  await runNpmScript(targetScript);
  printTimingAndExit(startTime);
}

process.on('unhandledRejection', handleError);

try {
  init();
} catch (error) {
  handleError(error);
}
