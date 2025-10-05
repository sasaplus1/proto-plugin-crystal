const versionsJsonUrl = 'https://crystal-lang.org/api/versions.json';

function fetchJson(url) {
  const request = {
    method: 'GET',
    url
  };
  const response = Http.request(request);
  if (response.status !== 200) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return JSON.parse(response.body);
}

function register_tool() {
  // const input = JSON.parse(Host.inputString());

  const output = {
    name: 'Crystal',
    type: 'language',
    plugin_version: '0.1.0',
    minimum_proto_version: '0.53.0'
  };

  Host.outputString(JSON.stringify(output));
}

function load_versions() {
  // const input = JSON.parse(Host.inputString());

  const data = fetchJson(versionsJsonUrl);

  const versions = data.versions
    .filter((v) => v.name !== 'nightly')
    .map((v) => v.name);

  const output = { versions };

  Host.outputString(JSON.stringify(output));
}

function download_prebuilt() {
  const input = JSON.parse(Host.inputString());

  const version = input.context.version;

  // Get host environment from Config
  const hostEnvStr = Config.get('host_environment');
  if (!hostEnvStr) {
    throw new Error('host_environment config is not available');
  }
  const hostEnv = JSON.parse(hostEnvStr);
  const os = hostEnv.os;
  const arch = hostEnv.arch;

  const supportedCombinations = {
    linux: ['x64', 'arm64'],
    macos: ['x64', 'arm64'],
    windows: ['x64']
  };

  if (!supportedCombinations[os] || !supportedCombinations[os].includes(arch)) {
    throw new Error(`Unsupported OS/architecture: ${os}/${arch}`);
  }

  const archMap = {
    x64: 'x86_64',
    arm64: 'aarch64'
  };
  const archName = archMap[arch] || 'x86_64';

  let archiveName;

  switch (os) {
    case 'linux':
      archiveName = `crystal-${version}-1-linux-${archName}-bundled.tar.gz`;
      break;
    case 'macos':
      archiveName = `crystal-${version}-1-darwin-universal.tar.gz`;
      break;
    case 'windows':
      archiveName = `crystal-${version}-windows-x86_64-msvc-unsupported.zip`;
      break;
    default:
      throw new Error(`Unsupported OS: ${os}`);
  }

  const downloadUrl = `https://github.com/crystal-lang/crystal/releases/download/${version}/${archiveName}`;

  const output = {
    download_url: downloadUrl,
    download_name: archiveName
  };

  Host.outputString(JSON.stringify(output));
}

function locate_executables() {
  const input = JSON.parse(Host.inputString());
  const version = input.context.version;
  const prefix = `crystal-${version}-1`;

  // Get host environment from Config
  const hostEnvStr = Config.get('host_environment');
  if (!hostEnvStr) {
    throw new Error('host_environment config is not available');
  }
  const hostEnv = JSON.parse(hostEnvStr);
  const os = hostEnv.os;

  const exes = {};

  switch (os) {
    case 'linux':
      exes.crystal = {
        exe_path: `${prefix}/bin/crystal`,
        primary: true
      };
      exes.shards = {
        exe_path: `${prefix}/bin/shards`
      };
      break;
    case 'macos':
      // macOS bin/crystal is a shell script that sets up environment variables
      exes.crystal = {
        exe_path: `${prefix}/bin/crystal`,
        primary: true
      };
      exes.shards = {
        exe_path: `${prefix}/embedded/bin/shards`
      };
      break;
    case 'windows':
      exes.crystal = {
        exe_path: 'crystal.exe',
        primary: true
      };
      exes.shards = {
        exe_path: 'shards.exe'
      };
      break;
    default:
      throw new Error(`Unsupported OS: ${os}`);
  }

  const output = { exes };

  Host.outputString(JSON.stringify(output));
}

function resolve_version() {
  const input = JSON.parse(Host.inputString());
  const version = input.initial;

  const output = {};

  if (version === 'latest' || version === 'stable') {
    const data = fetchJson(versionsJsonUrl);
    const latest = data.versions.find((v) => v.name !== 'nightly');

    output.version = latest ? latest.name : version;
  } else if (version === 'canary') {
    // Use nightly for canary
    output.version = 'nightly';
  } else {
    // Return as-is for specific versions
    output.version = version;
  }

  Host.outputString(JSON.stringify(output));
}

function detect_version_files() {
  // const input = JSON.parse(Host.inputString());

  const output = {
    files: ['.crystal-version', '.tool-versions']
  };

  Host.outputString(JSON.stringify(output));
}

function parse_version_file() {
  const input = JSON.parse(Host.inputString());
  const content = input.content;
  const file = input.file;

  let version = '';

  if (file === '.crystal-version') {
    version = content.trim();
  } else if (file === '.tool-versions') {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('crystal ')) {
        version = trimmed.slice(8).trim();
        break;
      }
    }
  }

  const output = { version };

  Host.outputString(JSON.stringify(output));
}

module.exports = {
  register_tool,
  load_versions,
  download_prebuilt,
  locate_executables,
  resolve_version,
  detect_version_files,
  parse_version_file
};
