/**
 * Reproduces the ruleset the Vercel build enforces.
 *
 * The repo's own eslintConfig extends both `react-app` and `react-app/jest`,
 * and the installed eslint-plugin-jest fails to register its environment in
 * this toolchain ("Environment key jest/globals is unknown"), which makes a
 * plain `react-scripts build` abort before it lints anything at all.
 *
 * The workaround was to build with DISABLE_ESLINT_PLUGIN=true — which skips
 * the very check that fails in CI, so a build could pass locally and fail on
 * deploy. It did, on an unused variable.
 *
 * This config drops only the jest half, so the rules that actually gate the
 * deploy still run. `--max-warnings 0` mirrors CI=true, which is what makes
 * react-scripts treat warnings as errors.
 *
 *   npm run lint:ci    lint exactly as the deploy does
 *   npm run verify     lint, then tests, then a production build
 */
module.exports = {
  extends: ['react-app'],
};
