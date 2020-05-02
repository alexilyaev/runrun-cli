# Contributing

**Working on your first Pull Request?** You can learn how from this _free_ course:  
[EggHead.io - How to Contribute to an Open Source Project on GitHub](https://egghead.io/series/how-to-contribute-to-an-open-source-project-on-github)

Feel free to open an issue to discuss feature requests, or if you're savvy, just PR.

## Style Guide

This project happily uses [Prettier](https://github.com/prettier/prettier) (reformat's code based on common practices) and [ESLint](https://github.com/eslint/eslint) (static analysis of code patterns, can also fix stuff).  
The result is a consistent code style and happy unicorns.

There's a Git `precommit` hook in this repo (using [husky](https://github.com/typicode/husky)),
so when you commit, all files will be formatted with Prettier and ESLint and the changes will be added
to the commit.

You can also setup [editor-integration](https://github.com/prettier/prettier#editor-integration)
for automatically reformatting your code with Prettier on Save or using a hotkey.

## Running In Development

`npm start` will run the same file that users run in projects.  
There are test configs under `tests/configs/`, so we can provide a specific config using:

```shell
npm start -- --config tests/configs/basic/package.json
```

### Testing in a real project

We can link our local `runrun-cli` repo as a global package on our machine, and
then use it as the user would in any other project.

Run this in your local `runrun-cli` repo:

```shell
yarn link
```

If the package is already linked, we can `yarn unlink` and `yarn link` again.
Now run `rr` in any project on your machine.

## Commit Message Format

```text
Tag: Short description (fixes #1234)

Longer description if necessary
```

Based on [ESLint commit message conventions](https://eslint.org/docs/developer-guide/contributing/pull-requests#step-2-make-your-changes)
