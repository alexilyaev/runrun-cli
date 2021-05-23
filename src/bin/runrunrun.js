#!/usr/bin/env node
'use strict';

// Override CLI options with custom args (emulates passing `-r` option).
// https://github.com/yargs/yargs/blob/master/docs/api.md#envprefix
process.env.RUNRUN_CLI_RERUN = true;

require('../lib/cli');
