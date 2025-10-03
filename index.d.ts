declare module 'main' {
  export function register_tool(): I32;
  export function load_versions(): I32;
  export function download_prebuilt(): I32;
  export function locate_executables(): I32;
  export function resolve_version(): I32;
}
