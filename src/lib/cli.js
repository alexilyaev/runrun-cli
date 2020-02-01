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

const pkg = require('../../package.json');

/**
 * Define command line arguments
 */
const args = yargs
  .usage('runrun [options]')
  .example('runrun', '')
  .example('runrun -a', '')
  .example('runrun -c path/to/package.custom.json', '')
  .option('c', {
    type: 'string',
    alias: 'config',
    describe: `Path to custom package.json`,
  })
  .option('a', {
    type: 'boolean',
    alias: 'all',
    describe: `Show all available scripts instead of just 10`,
  })
  .help('h')
  .alias('h', 'help')
  .group(['help'], 'General:')
  .wrap(100).argv;

const targetConfigPath = args.config
  ? path.resolve(args.config)
  : path.resolve(process.cwd(), 'package.json');
const configJson = require(targetConfigPath);

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
 */
function notifyOnUpdate() {
  updateNotifier({ configJson }).notify();
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
      limit: args.all ? _.keys(scripts).length : 20,
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
 * Hit it
 */
function init() {
  const startTime = time();

  process.on('unhandledRejection', handleError);

  Promise.resolve()
    .then(printBegin)
    .then(promptUser)
    .then(runNpmScript)
    .then(printTimingAndExit.bind(null, startTime))
    .then(notifyOnUpdate)
    .catch(handleError);
}

init();
