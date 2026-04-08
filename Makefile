PROTO_HOME := $(CURDIR)/.proto-home
WASM := crystal.wasm
MOONBIT_OUT := moonbit/_build/wasm/release/build/main/main.wasm

export PROTO_HOME

.PHONY: build test clean

build: $(WASM)

$(WASM): $(shell find moonbit -name '*.mbt' -o -name '*.json')
	cd moonbit && moon build --target wasm --release
	cp $(MOONBIT_OUT) $(WASM)

test: $(WASM)
	rm -rf $(PROTO_HOME)
	proto plugin add crystal "file://$(CURDIR)/$(WASM)"
	proto versions crystal
	proto install crystal 1.17.1
	proto plugin info crystal
	crystal --version
	shards --version
	proto install crystal latest
	rm -rf $(PROTO_HOME)

clean:
	rm -rf $(WASM) moonbit/_build $(PROTO_HOME)
