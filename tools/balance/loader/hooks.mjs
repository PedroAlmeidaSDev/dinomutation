const PHASER_STUB = new URL('./phaser-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'phaser') return { url: PHASER_STUB, shortCircuit: true };
  if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      // fall through to the default resolution
    }
  }
  return next(specifier, context);
}
