.DEFAULT_GOAL := all

SHELL := /bin/bash

makefile := $(abspath $(lastword $(MAKEFILE_LIST)))
makefile_dir := $(dir $(makefile))

PROTO_HOME := $(makefile_dir)/.proto-home
export PROTO_HOME

wasm := crystal.wasm
build_dir := _build
wasm_out := $(build_dir)/wasm/release/build/main/main.wasm

#-------------------------------------------------------------------------------

$(wasm): $(shell find main -name '*.mbt' -o -name '*.json') moon.mod.json
	moon build --target wasm --release
	cp $(wasm_out) $(wasm)

.PHONY: all
all: ## show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(makefile) | awk 'BEGIN { FS = ":.*?## " }; { printf "\033[36m%-30s\033[0m %s\n", $$1, $$2 }'

.PHONY: build
build: $(wasm) ## build WASM plugin

.PHONY: clean
clean: ## remove build artifacts and test environment
	$(RM) -rf $(wasm) $(build_dir) $(PROTO_HOME)

.PHONY: test
test: $(wasm) ## run proto tests with isolated PROTO_HOME
	rm -rf $(PROTO_HOME) $(makefile_dir)/.prototools
	proto plugin add crystal "file://$(makefile_dir)/$(wasm)"
	proto versions crystal
	proto install crystal 1.17.1
	proto plugin info crystal
	crystal --version
	shards --version
	proto install crystal latest
	rm -rf $(PROTO_HOME) $(makefile_dir)/.prototools
