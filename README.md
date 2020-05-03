# runrun-cli

[![version](https://img.shields.io/npm/v/runrun-cli?style=flat-square)](http://npm.im/runrun-cli)
[![MIT License](https://img.shields.io/npm/l/runrun-cli?style=flat-square)](http://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](http://makeapullrequest.com)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

Delightful interactive npm scripts runner.

## Demo

![runrun demo](demo.gif)

## Installation

Try it out with `npx`:

```shell
npx runrun-cli
```

Install globally (enables to execute `rr` and `rrr` anywhere):

```shell
npm install -g runrun-cli
```

## Usage

Interactively choose which script to run from `package.json`:

```shell
rr
```

Re-run last chosen script (same as `rr -r`):

```shell
rrr
```

For CLI options, use the `-h` (or `--help`) argument:

```shell
rr -h
```

## Contributing

See the [CONTRIBUTING](CONTRIBUTING.md) document.
