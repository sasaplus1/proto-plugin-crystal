const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const createPlugin = require('@extism/extism').default;

/** @type {import('@extism/extism').Plugin} */
let plugin;

/** @type {import('@extism/extism').Plugin} */
let pluginWithNetwork;

before(async () => {
  plugin = await createPlugin('./crystal.wasm', {
    useWasi: true
  });

  pluginWithNetwork = await createPlugin('./crystal.wasm', {
    useWasi: true,
    allowedHosts: ['crystal-lang.org'],
    runInWorker: true
  });
});

after(async () => {
  if (plugin) await plugin.close();
  if (pluginWithNetwork) await pluginWithNetwork.close();
});

/**
 * Call a plugin function and return parsed JSON
 * @param {import('@extism/extism').Plugin} p
 * @param {string} functionName
 * @param {Object|null} [input=null]
 * @returns {Promise<any>}
 */
async function callPlugin(p, functionName, input = null) {
  const inputData = input ? JSON.stringify(input) : undefined;
  const result = await p.call(functionName, inputData);
  return JSON.parse(new TextDecoder().decode(result.buffer));
}

describe('register_tool', () => {
  it('should return plugin metadata', async () => {
    const result = await callPlugin(plugin, 'register_tool');

    assert.deepStrictEqual(result, {
      name: 'Crystal',
      type: 'language',
      plugin_version: '0.1.0',
      minimum_proto_version: '0.53.0'
    });
  });
});

describe('load_versions', () => {
  it('should fetch versions from API and exclude nightly', async () => {
    const result = await callPlugin(pluginWithNetwork, 'load_versions');

    assert.ok(Array.isArray(result.versions));
    assert.ok(result.versions.length > 0);
    assert.ok(result.versions.every((v) => typeof v === 'string'));
    assert.ok(!result.versions.includes('nightly'));
  });
});

describe('resolve_version', () => {
  it('should resolve "latest" to a version number', async () => {
    const result = await callPlugin(pluginWithNetwork, 'resolve_version', {
      initial: 'latest'
    });

    assert.ok(result.version);
    assert.notStrictEqual(result.version, 'latest');
    assert.match(result.version, /^\d+\.\d+\.\d+$/);
  });

  it('should resolve "stable" to a version number', async () => {
    const result = await callPlugin(pluginWithNetwork, 'resolve_version', {
      initial: 'stable'
    });

    assert.ok(result.version);
    assert.notStrictEqual(result.version, 'stable');
    assert.match(result.version, /^\d+\.\d+\.\d+$/);
  });

  it('should resolve "canary" to "nightly"', async () => {
    const result = await callPlugin(plugin, 'resolve_version', {
      initial: 'canary'
    });

    assert.strictEqual(result.version, 'nightly');
  });

  it('should resolve "*" to a version number', async () => {
    const result = await callPlugin(pluginWithNetwork, 'resolve_version', {
      initial: '*'
    });

    assert.ok(result.version);
    assert.notStrictEqual(result.version, '*');
    assert.match(result.version, /^\d+\.\d+\.\d+$/);
  });

  it('should return specific version as-is', async () => {
    const result = await callPlugin(plugin, 'resolve_version', {
      initial: '1.10.0'
    });

    assert.strictEqual(result.version, '1.10.0');
  });
});

describe('detect_version_files', () => {
  it('should return supported version files', async () => {
    const result = await callPlugin(plugin, 'detect_version_files');

    assert.deepStrictEqual(result, {
      files: ['.crystal-version', '.tool-versions']
    });
  });
});

describe('parse_version_file', () => {
  it('should parse .crystal-version file', async () => {
    const result = await callPlugin(plugin, 'parse_version_file', {
      file: '.crystal-version',
      content: '1.10.1\n'
    });

    assert.deepStrictEqual(result, {
      version: '1.10.1'
    });
  });

  it('should parse .tool-versions file with crystal entry', async () => {
    const result = await callPlugin(plugin, 'parse_version_file', {
      file: '.tool-versions',
      content: 'nodejs 20.0.0\ncrystal 1.11.0\nruby 3.2.0\n'
    });

    assert.deepStrictEqual(result, {
      version: '1.11.0'
    });
  });

  it('should return empty version for .tool-versions without crystal entry', async () => {
    const result = await callPlugin(plugin, 'parse_version_file', {
      file: '.tool-versions',
      content: 'nodejs 20.0.0\nruby 3.2.0\n'
    });

    assert.deepStrictEqual(result, {
      version: ''
    });
  });
});
