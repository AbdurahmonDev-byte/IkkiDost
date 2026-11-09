const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch the whole workspace and resolve hoisted packages.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;
config.resolver.unstable_enableSymlinks = true;

// Workspace packages are published as TypeScript sources and use NodeNext-style
// explicit `.js` specifiers (e.g. `./enums.js`). Metro must map those back to
// the real `.ts` / `.tsx` files inside packages/.
const fallbackResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const origin = context.originModulePath || '';
    const fromWorkspaceSource = origin.includes(`${path.sep}packages${path.sep}`);
    if (fromWorkspaceSource) {
      const base = moduleName.slice(0, -3);
      for (const ext of ['.ts', '.tsx']) {
        try {
          return context.resolveRequest(context, `${base}${ext}`, platform);
        } catch {
          // Try the next candidate extension.
        }
      }
    }
  }
  return (fallbackResolver ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
