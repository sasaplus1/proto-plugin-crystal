const { spawn } = require('node:child_process');
const { describe, it } = require('node:test');
const assert = require('node:assert');

/**
 * @typedef {Object} CallExtismOptions
 * @property {string[]} [allowedHosts] - Array of allowed host domains
 */

/**
 * Call an Extism plugin function
 * @param {string} functionName - The name of the function to call
 * @param {Object|null} [input=null] - Input data to pass to the function
 * @param {CallExtismOptions} [options={}] - Additional options
 * @returns {Promise<any>} The parsed JSON response from the function
 */
function callExtism(functionName, input = null, options = {}) {
  return new Promise((resolve, reject) => {
    const args = ['call', 'crystal.wasm', functionName, '--wasi'];

    if (options.allowedHosts && Array.isArray(options.allowedHosts)) {
      for (const host of options.allowedHosts) {
        args.push(`--allow-host=${host}`);
      }
    }

    if (input) {
      args.push('--input', JSON.stringify(input));
    }

    const proc = spawn('extism', args);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${stderr}`));
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (_err) {
          reject(new Error(`Failed to parse JSON: ${stdout}`));
        }
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

describe('register_tool', () => {
  it('should return plugin metadata', async () => {
    const result = await callExtism('register_tool');

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
    const result = await callExtism('load_versions', null, {
      allowedHosts: ['crystal-lang.org']
    });

    assert.ok(Array.isArray(result.versions));
    assert.ok(result.versions.length > 0);
    assert.ok(result.versions.every((v) => typeof v === 'string'));
    assert.ok(!result.versions.includes('nightly'));
  });
});

describe('resolve_version', () => {
  it('should resolve "latest" to a version number', async () => {
    const result = await callExtism(
      'resolve_version',
      {
        initial: 'latest'
      },
      {
        allowedHosts: ['crystal-lang.org']
      }
    );

    assert.ok(result.version);
    assert.notStrictEqual(result.version, 'latest');
    assert.match(result.version, /^\d+\.\d+\.\d+$/);
  });

  it('should resolve "stable" to a version number', async () => {
    const result = await callExtism(
      'resolve_version',
      {
        initial: 'stable'
      },
      {
        allowedHosts: ['crystal-lang.org']
      }
    );

    assert.ok(result.version);
    assert.notStrictEqual(result.version, 'stable');
    assert.match(result.version, /^\d+\.\d+\.\d+$/);
  });

  it('should resolve "canary" to "nightly"', async () => {
    const result = await callExtism('resolve_version', {
      initial: 'canary'
    });

    assert.strictEqual(result.version, 'nightly');
  });

  it('should resolve "*" to a version number', async () => {
    const result = await callExtism(
      'resolve_version',
      {
        initial: '*'
      },
      {
        allowedHosts: ['crystal-lang.org']
      }
    );

    assert.ok(result.version);
    assert.notStrictEqual(result.version, '*');
    assert.match(result.version, /^\d+\.\d+\.\d+$/);
  });

  it('should return specific version as-is', async () => {
    const result = await callExtism('resolve_version', {
      initial: '1.10.0'
    });

    assert.strictEqual(result.version, '1.10.0');
  });
});

describe('detect_version_files', () => {
  it('should return supported version files', async () => {
    const result = await callExtism('detect_version_files');

    assert.deepStrictEqual(result, {
      files: ['.crystal-version', '.tool-versions']
    });
  });
});

describe('parse_version_file', () => {
  it('should parse .crystal-version file', async () => {
    const result = await callExtism('parse_version_file', {
      file: '.crystal-version',
      content: '1.10.1\n'
    });

    assert.deepStrictEqual(result, {
      version: '1.10.1'
    });
  });

  it('should parse .tool-versions file with crystal entry', async () => {
    const result = await callExtism('parse_version_file', {
      file: '.tool-versions',
      content: 'nodejs 20.0.0\ncrystal 1.11.0\nruby 3.2.0\n'
    });

    assert.deepStrictEqual(result, {
      version: '1.11.0'
    });
  });

  it('should return empty version for .tool-versions without crystal entry', async () => {
    const result = await callExtism('parse_version_file', {
      file: '.tool-versions',
      content: 'nodejs 20.0.0\nruby 3.2.0\n'
    });

    assert.deepStrictEqual(result, {
      version: ''
    });
  });
});
