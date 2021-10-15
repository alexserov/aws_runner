module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2021: true,
    },
    extends: [
        'airbnb-base',
    ],
    parserOptions: {
        ecmaVersion: 12,
    },
    rules: {
        'no-plusplus': 'off',
        'max-len': 'off',
        'no-use-before-define': 'off',
        indent: ['error', 4],
    },
};
