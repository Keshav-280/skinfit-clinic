const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.assetExts = [...config.resolver.assetExts, "task"];

/** Next.js uses `@/src/...` → repo `src/`. Resolve the same when Metro bundles shared `src/lib` files. */
const srcRoot = path.join(monorepoRoot, "src");
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@/src" || moduleName.startsWith("@/src/")) {
    const subpath =
      moduleName === "@/src" ? "" : moduleName.slice("@/src/".length);
    const target = subpath ? path.join(srcRoot, subpath) : srcRoot;
    return context.resolveRequest(
      {
        ...context,
        originModulePath: path.join(srcRoot, "_metro_alias_.ts"),
      },
      target,
      platform
    );
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
