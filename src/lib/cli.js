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

const pkg = require('../../package.json');

const defaultResultsLimit = 20;

/**
 * Define command line arguments
 */
const args = yargs
  .usage('rr [options]')
  .example('rr', '')
  .example('rr -a', '')
  .example('rr -c path/to/package.custom.json', '')
  .example('rrr', 'Rerun last executed script')
  .option('c', {
    type: 'string',
    alias: 'config',
    describe: `Path to custom package.json`,
  })
  .option('a', {
    type: 'boolean',
    alias: 'all',
    describe: `Show all available scripts instead of just ${defaultResultsLimit}`,
  })
  .option('r', {
    type: 'boolean',
    alias: 'rerun',
    describe: `Rerun the last executed script`,
  })
  .help('h')
  .alias('h', 'help')
  .group(['help'], 'General:')
  .wrap(100).argv;

const targetConfigPath = args.config
  ? path.resolve(args.config)
  : path.resolve(process.cwd(), 'package.json');
const configJson = require(targetConfigPath);

const cachePath = envPaths(configJson.name).data;
const cacheDataFile = path.join(cachePath, '.data.json');

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
      "If you can't settle this, please open an issue at:" +
        EOL +
        chalk.cyan(pkg.bugs.url)
    )
  );
  process.exit(1);
}

/**
 * Print to stdout
 *
 * @param {string} heading
 * @param {Array}  [data]
 *
 * @see [columnify](https://github.com/timoxley/columnify)
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
  printColumns(chalk.whiteBright.bold(`runrun v${pkg.version}`));
}

/**
 * Print how long it took the tool to execute
 */
function printTimingAndExit(startTime) {
  const execTime = time() - startTime;

  printColumns(chalk.green(`Finished in: ${execTime.toFixed()}ms`));
  process.exit(0);
}

/**
 * Check for package update
 * https://github.com/yeoman/update-notifier
 */
function notifyOnUpdate() {
  const notifier = updateNotifier({
    pkg: {
      name: configJson.name,
      version: configJson.version,
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
 * @see [prompts](https://github.com/terkelg/prompts)
 */
async function promptUser() {
  const { scripts } = configJson;

  if (!scripts) {
    printColumns(
      chalk.red('There are no npm scripts found in the target package.json')
    );
    process.exit(0);
  }

  if (args.r) {
    const cache = await fs.readJson(cacheDataFile);

    return cache.lastTargetedScript;
  }

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
      limit: args.all ? _.keys(scripts).length : defaultResultsLimit,
    },
  ]);

  if (_.isEmpty(responses)) {
    printColumns('Aborting...');

    return process.exit();
  }

  return responses.script;
}

/**
 * @param {string} targetScriptName The npm script to run
 * @see [execa options](https://github.com/sindresorhus/execa#options)
 */
function runNpmScript(targetScriptName) {
  return execa.command(`npm run ${targetScriptName}`, {
    cwd: path.dirname(targetConfigPath),
    stdio: 'inherit',
  });
}

/**
 *
 */
async function cacheTargetScript(targetScriptName) {
  await fs.ensureDir(cachePath);
  await fs.writeJson(cacheDataFile, {
    lastTargetedScript: targetScriptName,
  });
}

/**
 * Hit it
 */
async function init() {
  const startTime = time();

  process.on('unhandledRejection', handleError);

  printBegin();
  notifyOnUpdate();
  const targetScript = await promptUser();

  await runNpmScript(targetScript);
  await cacheTargetScript(targetScript);
  printTimingAndExit(startTime);
}

try {
  init();
} catch (error) {
  handleError(error);
}
