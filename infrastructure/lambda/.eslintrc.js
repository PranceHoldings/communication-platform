/**
 * ESLint Configuration for Lambda Functions
 * ENFORCED: Prevents direct response construction
 */

module.exports = {
  extends: ['../../.eslintrc.js'],
  rules: {
    // CRITICAL: Prevent direct response construction
    'no-restricted-syntax': [
      'error',
      {
        selector: `ReturnStatement > ObjectExpression:has(Property[key.name="statusCode"]):has(Property[key.name="body"])`,
        message:
          '❌ FORBIDDEN: Direct response construction.\n' +
          '✅ FIX: Use successResponse() or errorResponse() from shared/utils/response.ts\n' +
          'Example: return successResponse({ items: data });',
      },
      {
        selector: `CallExpression[callee.property.name="stringify"]:has(ObjectExpression:not(:has(Property[key.name="success"])))`,
        message:
          '❌ WARNING: JSON.stringify() without "success" field.\n' +
          '✅ FIX: Ensure response has { success: true/false } structure.\n' +
          'Use successResponse() or errorResponse() utilities.',
      },
    ],

    // Warn about console.log in production code (except shared/utils/response.ts)
    'no-console': ['warn', { allow: ['error', 'warn', 'info'] }],

    // Enforce explicit return types for Lambda handlers
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      {
        allowExpressions: false,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
      },
    ],
  },
  overrides: [
    {
      files: ['shared/utils/response.ts'],
      rules: {
        // Allow direct construction in response.ts utility
        'no-restricted-syntax': 'off',
      },
    },
  ],
};
