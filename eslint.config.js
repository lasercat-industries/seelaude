// eslint.config.js
import baseConfig from '@lasercat/config/eslint.config.js';

export default [
  ...baseConfig,
  {
    rules: {
      "unicorn/prefer-switch": "off",
    },
  },
];