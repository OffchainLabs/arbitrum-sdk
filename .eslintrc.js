module.exports = {
  root: true,
  env: {
    commonjs: true,
    es6: true,
    node: true,
  },
  plugins: ['prettier'],
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
  ],
  parserOptions: {
    ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
  },
  rules: {
    'prettier/prettier': 'error',
    'no-unused-vars': 'off',
    'prefer-const': [2, { destructuring: 'all' }],
    'object-curly-spacing': ['error', 'always'],
  },
  overrides: [
    {
      // this config is run against test files (same as the one bellow but not limited to `src` folder)
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
      ],
      plugins: ['@typescript-eslint', 'prettier'],
      rules: {
        'no-empty-pattern': 'warn',
        'prettier/prettier': ['error', { singleQuote: true }],
        '@typescript-eslint/member-delimiter-style': ['off'],
        '@typescript-eslint/no-explicit-any': ['off'],
        '@typescript-eslint/no-use-before-define': ['off'],
        '@typescript-eslint/no-non-null-assertion': ['off'],
        '@typescript-eslint/ban-ts-comment': ['warn'],
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        'no-implicit-coercion': 'error',
      },
    },
    {
      files: ['src/**/*.ts', 'src/**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: 'tsconfig.json',
      },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
      ],
      plugins: ['@typescript-eslint', 'prettier', '@typescript-eslint/tslint'],
      rules: {
        'no-empty-pattern': 'warn',
        'prettier/prettier': ['error', { singleQuote: true }],
        '@typescript-eslint/member-delimiter-style': ['off'],
        '@typescript-eslint/no-explicit-any': ['off'],
        '@typescript-eslint/no-use-before-define': ['off'],
        '@typescript-eslint/no-non-null-assertion': ['off'],
        '@typescript-eslint/ban-ts-comment': ['warn'],
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        '@typescript-eslint/tslint/config': [
          'error',
          {
            rules: { 'strict-comparisons': true },
          },
        ],
        'no-implicit-coercion': 'error',
        '@typescript-eslint/no-shadow': ['error'],
      },
    },
  ],
}
