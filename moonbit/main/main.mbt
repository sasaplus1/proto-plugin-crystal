// proto-plugin-crystal: MoonBit implementation

let versions_json_url : String = "https://crystal-lang.org/api/versions.json"

// http_get sends a GET request and returns (status_code, body_memory).
// Caller must call body_mem.free() after reading the response.
fn http_get(url : String) -> (Int, @host.Memory) {
  let meta : Json = { "method": "GET", "headers": {}, "url": url }
  let meta_mem = @host.allocate_json_value(meta)
  let response_offset = @extism.http_request(meta_mem.offset, 0L)
  let response_length = @extism.length(response_offset)
  let status_code = @extism.http_status_code()
  let body : @host.Memory = { offset: response_offset, length: response_length }
  (status_code, body)
}

// register_tool returns plugin metadata
pub fn register_tool() -> Int {
  let output : Json = {
    "name": "Crystal",
    "type": "language",
    "plugin_version": "0.1.0",
    "minimum_proto_version": "0.53.0"
  }
  @host.output_json_value(output)
  return 0
}

// detect_version_files returns version detection file list
pub fn detect_version_files() -> Int {
  let output : Json = {
    "files": [".crystal-version", ".tool-versions"]
  }
  @host.output_json_value(output)
  return 0
}

// parse_version_file parses version from file content
pub fn parse_version_file() -> Int {
  let input = @host.input_string()

  let parsed = try {
    @json.parse(input)
  } catch {
    _ => {
      @host.set_error("Failed to parse input JSON")
      return 1
    }
  }

  let file = get_string(parsed, "file")
  let content = get_string(parsed, "content")

  let version = if file == ".crystal-version" {
    content.trim().to_string()
  } else if file == ".tool-versions" {
    parse_tool_versions(content)
  } else {
    ""
  }

  let output : Json = { "version": version }
  @host.output_json_value(output)
  return 0
}

fn parse_tool_versions(content : String) -> String {
  let lines = content.split("\n")
  for line in lines {
    let trimmed = line.trim().to_string()
    if trimmed.has_prefix("crystal ") {
      return trimmed.substring(start=8).trim().to_string()
    }
  }
  return ""
}

// load_versions fetches available Crystal versions from API
pub fn load_versions() -> Int {
  let (status_code, body_mem) = http_get(versions_json_url)

  if status_code != 200 {
    body_mem.free()
    @host.set_error("Failed to fetch versions: HTTP \{status_code}")
    return 1
  }

  let body = body_mem.to_string()
  body_mem.free()

  let parsed = try {
    @json.parse(body)
  } catch {
    _ => {
      @host.set_error("Failed to parse versions JSON")
      return 1
    }
  }

  let versions_array = get_array(parsed, "versions")
  let filtered : Array[Json] = []

  for item in versions_array {
    let name = get_string(item, "name")
    if name != "nightly" && name != "" {
      filtered.push(name.to_json())
    }
  }

  let output : Json = { "versions": filtered.to_json() }
  @host.output_json_value(output)
  return 0
}

// resolve_version resolves version aliases
pub fn resolve_version() -> Int {
  let input = @host.input_string()

  let parsed = try {
    @json.parse(input)
  } catch {
    _ => {
      @host.set_error("Failed to parse input JSON")
      return 1
    }
  }

  let version = get_string(parsed, "initial")

  let resolved = if version == "latest" || version == "stable" || version == "*" {
    fetch_latest_version(version)
  } else if version == "canary" {
    "nightly"
  } else {
    version
  }

  // Check for error from fetch_latest_version
  if resolved == "" {
    return 1
  }

  let output : Json = { "version": resolved }
  @host.output_json_value(output)
  return 0
}

fn fetch_latest_version(fallback : String) -> String {
  let (status_code, body_mem) = http_get(versions_json_url)

  if status_code != 200 {
    body_mem.free()
    @host.set_error("Failed to fetch versions: HTTP \{status_code}")
    return ""
  }

  let body = body_mem.to_string()
  body_mem.free()

  let parsed = try {
    @json.parse(body)
  } catch {
    _ => {
      @host.set_error("Failed to parse versions JSON")
      return ""
    }
  }

  let versions_array = get_array(parsed, "versions")

  for item in versions_array {
    let name = get_string(item, "name")
    if name != "nightly" && name != "" {
      return name
    }
  }

  return fallback
}

// download_prebuilt constructs download URL based on OS/arch
pub fn download_prebuilt() -> Int {
  let input = @host.input_string()

  let parsed = try {
    @json.parse(input)
  } catch {
    _ => {
      @host.set_error("Failed to parse input JSON")
      return 1
    }
  }

  let version = get_nested_string(parsed, "context", "version")

  let host_env_str = match @config.get("host_environment") {
    Some(s) => s
    None => {
      @host.set_error("host_environment config is not available")
      return 1
    }
  }

  let host_env = try {
    @json.parse(host_env_str)
  } catch {
    _ => {
      @host.set_error("Failed to parse host_environment JSON")
      return 1
    }
  }

  let os = get_string(host_env, "os")
  let arch = get_string(host_env, "arch")

  let valid = match os {
    "linux" => arch == "x64" || arch == "arm64"
    "macos" => arch == "x64" || arch == "arm64"
    "windows" => arch == "x64"
    _ => false
  }

  if not(valid) {
    @host.set_error("Unsupported OS/architecture: \{os}/\{arch}")
    return 1
  }

  let arch_name = if arch == "arm64" { "aarch64" } else { "x86_64" }

  let archive_name = match os {
    "linux" => "crystal-\{version}-1-linux-\{arch_name}-bundled.tar.gz"
    "macos" => "crystal-\{version}-1-darwin-universal.tar.gz"
    "windows" => "crystal-\{version}-windows-x86_64-msvc-unsupported.zip"
    _ => {
      @host.set_error("Unsupported OS: \{os}")
      return 1
    }
  }

  let download_url = "https://github.com/crystal-lang/crystal/releases/download/\{version}/\{archive_name}"

  let output : Json = {
    "download_url": download_url,
    "download_name": archive_name
  }
  @host.output_json_value(output)
  return 0
}

// locate_executables returns binary locations after install
pub fn locate_executables() -> Int {
  let input = @host.input_string()

  let parsed = try {
    @json.parse(input)
  } catch {
    _ => {
      @host.set_error("Failed to parse input JSON")
      return 1
    }
  }

  let version = get_nested_string(parsed, "context", "version")
  let prefix = "crystal-\{version}-1"

  let host_env_str = match @config.get("host_environment") {
    Some(s) => s
    None => {
      @host.set_error("host_environment config is not available")
      return 1
    }
  }

  let host_env = try {
    @json.parse(host_env_str)
  } catch {
    _ => {
      @host.set_error("Failed to parse host_environment JSON")
      return 1
    }
  }

  let os = get_string(host_env, "os")

  let output : Json = match os {
    "linux" => {
      "exes": {
        "crystal": { "exe_path": "\{prefix}/bin/crystal", "primary": true },
        "shards": { "exe_path": "\{prefix}/bin/shards" }
      }
    }
    "macos" => {
      "exes": {
        "crystal": { "exe_path": "\{prefix}/bin/crystal", "primary": true },
        "shards": { "exe_path": "\{prefix}/embedded/bin/shards" }
      }
    }
    "windows" => {
      "exes": {
        "crystal": { "exe_path": "crystal.exe", "primary": true },
        "shards": { "exe_path": "shards.exe" }
      }
    }
    _ => {
      @host.set_error("Unsupported OS: \{os}")
      return 1
    }
  }

  @host.output_json_value(output)
  return 0
}

// Helper: get string value from JSON object
fn get_string(json : Json, key : String) -> String {
  match json {
    Object(map) => match map.get(key) {
      Some(String(s)) => s
      _ => ""
    }
    _ => ""
  }
}

// Helper: get array value from JSON object
fn get_array(json : Json, key : String) -> Array[Json] {
  match json {
    Object(map) => match map.get(key) {
      Some(Array(arr)) => arr
      _ => []
    }
    _ => []
  }
}

// Helper: get nested string value from JSON object
fn get_nested_string(json : Json, key1 : String, key2 : String) -> String {
  match json {
    Object(map) => match map.get(key1) {
      Some(Object(inner)) => match inner.get(key2) {
        Some(String(s)) => s
        _ => ""
      }
      _ => ""
    }
    _ => ""
  }
}
