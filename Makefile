# Makefile
.PHONY: install dev build test coverage format clean

install:
	pnpm install
	cd packages/contracts && forge install foundry-rs/forge-std@v1.9.7 --no-commit
	cd packages/contracts && forge install OpenZeppelin/openzeppelin-contracts@v5.4.0 --no-commit

dev:
	pnpm dev

build:
	pnpm build
	pnpm contracts:build

test:
	pnpm contracts:test
	pnpm typecheck
	pnpm lint

coverage:
	pnpm contracts:coverage

format:
	pnpm format
	cd packages/contracts && forge fmt

clean:
	rm -rf node_modules apps/web/.next packages/config/dist
	cd packages/contracts && forge clean
