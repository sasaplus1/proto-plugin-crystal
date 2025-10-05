# proto-plugin-crystal

[Crystal](https://crystal-lang.org/) plugin for [moonrepo/proto](https://moonrepo.dev/proto)

## Installation

Add the following to `.prototools`:

```toml
[plugins]
crystal = "github://sasaplus1/proto-plugin-crystal"
```

Or use a specific version:

```toml
[plugins]
crystal = "github://sasaplus1/proto-plugin-crystal@v0.1.0"
```

## Usage

```bash
# List available versions
$ proto versions crystal
```

```bash
# Install a specific version
$ proto install crystal 1.17.1
```

```bash
# Install the latest version
$ proto install crystal latest
```

## Version detection

This plugin supports automatic version detection from:

- `.crystal-version`
- `.tool-versions`

Create a `.crystal-version` file in your project:

```bash
$ echo '1.17.0' > .crystal-version
$ proto install
```

## Development

### Prerequisites

- [devbox](https://www.jetify.com/devbox)
- Node.js & npm

### Setup

```bash
# Enter devbox shell (automatically installs extism-cli, binaryen, gh, and extism-js)
$ devbox shell
```

```bash
$ npm ci
$ npm run build
```

## License

The MIT license
