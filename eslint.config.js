'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: globals.node
        },
        rules: {
            'no-unused-vars': ['error', { args: 'after-used', caughtErrors: 'none' }],
            'no-control-regex': 'off',
            'indent': ['error', 4, { SwitchCase: 1 }],
            'semi': ['error', 'always'],
            'eqeqeq': ['error', 'smart']
        }
    }
];
