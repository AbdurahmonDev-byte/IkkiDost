const path = require('path');

/**
 * Bundles the API (including the local @ikki-dost/* workspace packages) into
 * dist/main.js. Native/heavy node_modules stay external.
 */
module.exports = function (options) {
  return {
    ...options,
    resolve: {
      ...options.resolve,
      extensionAlias: { '.js': ['.ts', '.js'] },
      alias: {
        ...options.resolve?.alias,
        '@ikki-dost/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
        '@ikki-dost/utils': path.resolve(__dirname, '../../packages/utils/src/index.ts'),
        '@ikki-dost/validation': path.resolve(__dirname, '../../packages/validation/src/index.ts'),
      },
    },
    externals: [
      // Keep everything from node_modules external EXCEPT our workspace packages
      // (they are TS sources that must be compiled into the bundle).
      function ({ request }, callback) {
        if (request && request.startsWith('@ikki-dost/')) return callback();
        if (request && !request.startsWith('.') && !path.isAbsolute(request)) return callback(null, 'commonjs ' + request);
        callback();
      },
    ],
  };
};
