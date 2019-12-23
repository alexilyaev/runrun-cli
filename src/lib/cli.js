'use strict';

const columnify = require('columnify');
const chalk = require('chalk');
const yargs = require('yargs');
const EOL = require('os').EOL;

const pkg = require('../../package.json');

/**
 * Define command line arguments
 */
yargs
  .usage('runrun [options]')
  .example('runrun', '')
  // .option('v', {
  //   type: 'boolean',
  //   alias: 'version',
  //   describe: `Print current version of runrun`,
  // })
  .help('h')
  .alias('h', 'help')
  .group(['help'], 'General:')
  .wrap(100).argv;

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
 * Hit it
 */
function init() {
  const startTime = time();

  process.on('unhandledRejection', handleError);

  Promise.resolve()
    .then(printBegin)
    .then(printTimingAndExit.bind(null, startTime))
    .catch(handleError);
}

init();
