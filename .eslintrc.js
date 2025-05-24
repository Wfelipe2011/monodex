module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint/eslint-plugin',
    'import', // Plugin adicional para ordenação de imports
    'unused-imports', // Plugin para detectar imports não usados
  ],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:import/recommended', // Boas práticas de imports
    'plugin:import/typescript', // Suporte a TypeScript
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    // ---- Regras Principais como Warnings ----
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/await-thenable': 'warn',
    '@typescript-eslint/no-misused-promises': 'warn',
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
    '@typescript-eslint/restrict-plus-operands': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',

    // ---- Regras de Boas Práticas ----
    'no-empty': 'warn',
    'no-extra-boolean-cast': 'warn',
    'no-unreachable': 'warn',
    curly: 'warn',
    eqeqeq: 'warn',

    // ---- Regras de Imports ----
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true }, // Ordem alfabética
      },
    ],
    'unused-imports/no-unused-imports': 'warn',
    // --- Regras Específicas ---
    'import/namespace': 'off', // Desliga (conflita com TypeScript)
    'import/no-duplicates': 'off', // Desliga (conflita com TypeScript)
    'import/no-unresolved': 'off', // Desliga (conflita com TypeScript)
    'import/named': 'off',
    'prettier/prettier': [
      'warn',
      {
        singleQuote: true,
        trailingComma: 'all',
        printWidth: 180,
      },
    ],
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: [
          'tsconfig.json', // Configuração global
        ],
        alwaysTryTypes: true, // Prioriza tipos TypeScript
      },
    },
  },
};
