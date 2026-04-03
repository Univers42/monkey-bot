SHELL := /bin/bash
.SHELLFLAGS := -ec

RED				:= \033[0;31m
GREEN			:= \033[0;32m
YELLOW			:= \033[0;33m
BLUE			:= \033[0;34m
MAGENTA			:= \033[0;35m
CYAN			:= \033[0;36m
RESET			:= \033[0m
NC				:= $(RESET)
DOCKER_COMPOSE 	:= docker compose
OK				:= $(GREEN)🗸
WARNING			:= $(YELLOW)⚠
ERROR			:= $(RED)𐄂

DEFAULT_GOAL 	:= help

NOPRINT			:= --no-print-directory

HOOKS_DIR := vendor/scripts/hooks
PROJECT ?= notion-like
ENV ?= local
SUITE ?= wave-1
SCENARIO ?=
WORKERS ?= 1
ACTORS ?=
CONCURRENCY ?=
RETRIES ?= 0
REPORT_INPUT ?= reports/$(PROJECT)/latest/results.json
QA_EXTRA_ARGS ?=

.PHONY: ensure-env configure-hooks check-node check-docker check-deps ensure-output-dirs \
	install dev test lint lint-fix typecheck audit update help \
	qa-list-scenarios qa-list-suites qa-doctor qa-run-suite qa-run-scenario qa-wave-1 qa-report \
	docker-build docker-up docker-images docker-qa-build docker-qa-prepare docker-qa-doctor \
	docker-qa-run docker-qa-suite docker-qa-scenario docker-qa-wave-1 docker-remove docker-down \
	docker-fclean docker-re

# ? 🧪 Ensure .env file exists
ensure-env:
	@$(MAKE) configure-hooks > /dev/null
	@bash -c ./vendor/ensure_dotenv.sh
	@echo -e "$(GREEN)$(OK) .env file is present.$(RESET)"

# ? 🪝 Activate git hooks (auto-runs on make / make dev)
configure-hooks:
	@if [ ! -d .git ]; then \
		echo -e "  $(YELLOW)⚠$(NC)  Not a git repo — skipping hook setup"; \
	else \
		CURRENT=$$(git config --local core.hooksPath 2>/dev/null || echo ""); \
		if [ "$$CURRENT" = "$(HOOKS_DIR)" ]; then \
			echo -e "  $(GREEN)✓$(NC)  Git hooks active (core.hooksPath → $(HOOKS_DIR))"; \
		else \
			git config --local core.hooksPath $(HOOKS_DIR); \
			chmod +x $(HOOKS_DIR)/*; \
			echo -e "  $(GREEN)✓$(NC)  Git hooks activated (core.hooksPath → $(HOOKS_DIR))"; \
		fi; \
		for old in commit-msg pre-commit pre-push post-checkout pre-merge-commit log_hook log_hook.sh; do \
			if [ -L ".git/hooks/$$old" ]; then rm -f ".git/hooks/$$old"; fi; \
		done; \
	fi

# ? 🔨 Checks for required dependencies (Node.js and pnpm)
check-deps:
	@$(MAKE) configure-hooks > /dev/null
	@echo -e "$(CYAN)Checking dependencies...$(RESET)"
	@which docker > /dev/null && { echo -e "$(GREEN)$(OK) Docker is installed.$(RESET)"; } || { echo -e "$(RED)$(ERROR) Docker is not installed. Please install it to proceed.$(RESET)"; exit 1; }
# ? 🔨 Checks for required local dependencies (Node.js and pnpm)
check-node:
	@echo -e "$(CYAN)Checking local dependencies...$(RESET)"
	@which node > /dev/null && { echo -e "$(GREEN)$(OK) Node.js is installed.$(RESET)"; } || { echo -e "$(RED)$(ERROR) Node.js is not installed. Please install it to proceed.$(RESET)"; exit 1; }
	@which pnpm > /dev/null && { echo -e "$(GREEN)$(OK) pnpm is installed.$(RESET)"; } || { echo -e "$(RED)$(ERROR) pnpm is not installed. Please install it to proceed.$(RESET)"; exit 1; }
	@echo -e
	@echo -e "$(GREEN)Local dependencies are satisfied.$(RESET)"

# ? 🐳 Checks for Docker
check-docker:
	@echo -e "$(CYAN)Checking Docker...$(RESET)"
	@which docker > /dev/null && { echo -e "$(GREEN)$(OK) Docker is installed.$(RESET)"; } || { echo -e "$(RED)$(ERROR) Docker is not installed. Please install it to proceed.$(RESET)"; exit 1; }

# ? 🔨 Checks for all required dependencies
check-deps: check-node check-docker
	@echo -e "$(GREEN)All dependencies are satisfied.$(RESET)"

# ? 📦 Installs project dependencies
install:
	@$(MAKE) check-node $(NOPRINT)
	@$(MAKE) ensure-env $(NOPRINT)
	@pnpm install
	@echo -e "$(GREEN)$(OK) Dependencies installed successfully!$(RESET)"

# ? 📁 Ensures report and artifact folders exist
ensure-output-dirs:
	@mkdir -p artifacts reports
	@echo -e "$(GREEN)$(OK) Output directories are ready.$(RESET)"

# ? 🚀 Starts the local development server
dev:
	@$(MAKE) configure-hooks $(NOPRINT)
	@$(MAKE) check-node $(NOPRINT)
	@$(MAKE) ensure-env $(NOPRINT)
	@pnpm run dev

# ? ✅ Runs the fast local validation suite
test: lint typecheck
	@echo -e "$(GREEN)$(OK) Local validation completed successfully!$(RESET)"

# ? 📚 Lists available QA scenarios
qa-list-scenarios:
	@pnpm run qa-bots -- list --project $(PROJECT) --scenarios

# ? 📚 Lists available QA suites
qa-list-suites:
	@pnpm run qa-bots -- list --project $(PROJECT) --suites

# ? 🩺 Runs QA environment checks locally
qa-doctor:
	@pnpm run qa-bots -- doctor --project $(PROJECT) --env $(ENV)

# ? 🧪 Runs a QA suite locally
qa-run-suite:
	@if [ -z "$(SUITE)" ]; then \
		echo -e "$(RED)$(ERROR) SUITE is required. Example: make qa-run-suite SUITE=wave-1$(RESET)"; \
		exit 1; \
	fi
	@args="run --project $(PROJECT) --suite $(SUITE) --env $(ENV) --workers $(WORKERS) --retries $(RETRIES)"; \
	if [ -n "$(CONCURRENCY)" ]; then args="$$args --concurrency $(CONCURRENCY)"; fi; \
	if [ -n "$(ACTORS)" ]; then args="$$args --actors $(ACTORS)"; fi; \
	if [ -n "$(QA_EXTRA_ARGS)" ]; then args="$$args $(QA_EXTRA_ARGS)"; fi; \
	echo -e "$(BLUE)Running suite with: pnpm run qa-bots -- $$args$(RESET)"; \
	pnpm run qa-bots -- $$args

# ? 🎯 Runs a single QA scenario locally
qa-run-scenario:
	@if [ -z "$(SCENARIO)" ]; then \
		echo -e "$(RED)$(ERROR) SCENARIO is required. Example: make qa-run-scenario SCENARIO=login-success$(RESET)"; \
		exit 1; \
	fi
	@args="run --project $(PROJECT) --scenario $(SCENARIO) --env $(ENV) --workers $(WORKERS) --retries $(RETRIES)"; \
	if [ -n "$(CONCURRENCY)" ]; then args="$$args --concurrency $(CONCURRENCY)"; fi; \
	if [ -n "$(ACTORS)" ]; then args="$$args --actors $(ACTORS)"; fi; \
	if [ -n "$(QA_EXTRA_ARGS)" ]; then args="$$args $(QA_EXTRA_ARGS)"; fi; \
	echo -e "$(BLUE)Running scenario with: pnpm run qa-bots -- $$args$(RESET)"; \
	pnpm run qa-bots -- $$args

# ? 🌊 Runs the default wave-1 QA suite locally
qa-wave-1:
	@$(MAKE) qa-run-suite $(NOPRINT) SUITE=wave-1

# ? 📄 Renders the latest QA report
qa-report:
	@pnpm run qa-bots -- report --input $(REPORT_INPUT)

# ? 🔨 Builds the Docker image
docker-build:
	@$(MAKE) configure-hooks > /dev/null
	@$(MAKE) check-deps $(NOPRINT)
	@$(MAKE) ensure-env $(NOPRINT)
	@$(DOCKER_COMPOSE) build
	@echo -e "$(GREEN)$(OK) Docker image has been built successfully!$(RESET)"

# ? 🚀 Starts the Docker service in detached mode
docker-up:
	@$(MAKE) configure-hooks > /dev/null
	@$(DOCKER_COMPOSE) up -d
	@echo -e "$(GREEN)$(OK) Docker service is up and running!$(RESET)"
	@echo -e "$(CYAN) Visit http://localhost:3000 $(RESET)"

# ? 🧱 Builds both the app image and the qa-runner image
docker-images:
	@$(MAKE) docker-build $(NOPRINT)
	@$(MAKE) docker-qa-build $(NOPRINT)
	@echo -e "$(GREEN)$(OK) App and QA runner images are ready.$(RESET)"

# ? 🧪 Builds the qa-runner image
docker-qa-build:
	@$(MAKE) check-deps $(NOPRINT)
	@$(MAKE) ensure-env $(NOPRINT)
	@$(DOCKER_COMPOSE) --profile qa build qa-runner
	@echo -e "$(GREEN)$(OK) qa-runner image has been built successfully!$(RESET)"

# ? 🧪 Prepares Docker images, app container, and output folders for QA runs
docker-qa-prepare:
	@$(MAKE) ensure-output-dirs $(NOPRINT)
	@$(MAKE) docker-images $(NOPRINT)
	@$(DOCKER_COMPOSE) up -d app
	@echo -e "$(GREEN)$(OK) Docker QA environment is ready.$(RESET)"

# ? 🩺 Runs QA environment checks inside the qa-runner container
docker-qa-doctor:
	@$(MAKE) docker-qa-prepare $(NOPRINT)
	@$(DOCKER_COMPOSE) --profile qa run --rm qa-runner doctor --project $(PROJECT) --env $(ENV)

# ? 🧪 Runs a QA suite inside the qa-runner container
docker-qa-suite:
	@if [ -z "$(SUITE)" ]; then \
		echo -e "$(RED)$(ERROR) SUITE is required. Example: make docker-qa-suite SUITE=wave-1$(RESET)"; \
		exit 1; \
	fi
	@$(MAKE) docker-qa-prepare $(NOPRINT)
	@args="run --project $(PROJECT) --suite $(SUITE) --env $(ENV) --workers $(WORKERS) --retries $(RETRIES)"; \
	if [ -n "$(CONCURRENCY)" ]; then args="$$args --concurrency $(CONCURRENCY)"; fi; \
	if [ -n "$(ACTORS)" ]; then args="$$args --actors $(ACTORS)"; fi; \
	if [ -n "$(QA_EXTRA_ARGS)" ]; then args="$$args $(QA_EXTRA_ARGS)"; fi; \
	echo -e "$(BLUE)Running qa-runner with: $$args$(RESET)"; \
	$(DOCKER_COMPOSE) --profile qa run --rm qa-runner $$args; \
	echo -e "$(GREEN)$(OK) qa-runner completed. Reports in ./reports and artifacts in ./artifacts.$(RESET)"

# ? 🎯 Runs a single QA scenario inside the qa-runner container
docker-qa-scenario:
	@if [ -z "$(SCENARIO)" ]; then \
		echo -e "$(RED)$(ERROR) SCENARIO is required. Example: make docker-qa-scenario SCENARIO=login-success$(RESET)"; \
		exit 1; \
	fi
	@$(MAKE) docker-qa-prepare $(NOPRINT)
	@args="run --project $(PROJECT) --scenario $(SCENARIO) --env $(ENV) --workers $(WORKERS) --retries $(RETRIES)"; \
	if [ -n "$(CONCURRENCY)" ]; then args="$$args --concurrency $(CONCURRENCY)"; fi; \
	if [ -n "$(ACTORS)" ]; then args="$$args --actors $(ACTORS)"; fi; \
	if [ -n "$(QA_EXTRA_ARGS)" ]; then args="$$args $(QA_EXTRA_ARGS)"; fi; \
	echo -e "$(BLUE)Running qa-runner with: $$args$(RESET)"; \
	$(DOCKER_COMPOSE) --profile qa run --rm qa-runner $$args; \
	echo -e "$(GREEN)$(OK) qa-runner completed. Reports in ./reports and artifacts in ./artifacts.$(RESET)"

# ? 🌊 Runs the default wave-1 QA suite inside Docker
docker-qa-wave-1:
	@$(MAKE) docker-qa-suite $(NOPRINT) SUITE=wave-1

# ? 🔁 Legacy alias for the default Docker QA run
docker-qa-run:
	@$(MAKE) docker-qa-wave-1 $(NOPRINT)

# ? 🗑️  Stops and removes the Docker service, network, volumes, and local images
docker-remove:
	@$(MAKE) configure-hooks > /dev/null
	@$(DOCKER_COMPOSE) down --rmi local --volumes --remove-orphans
	@echo -e "$(GREEN)$(OK) Docker service has been removed.$(RESET)"

# ? 🛑 Stops the Docker service and removes containers and networks
docker-down:
	@$(MAKE) configure-hooks > /dev/null
	@$(DOCKER_COMPOSE) down
	@echo -e "$(GREEN)$(OK) Docker service has been stopped and containers removed.$(RESET)"

# ? 🧹 Stops the Docker service and removes all images, volumes, and orphan containers
docker-fclean:
	@$(MAKE) configure-hooks > /dev/null
	@echo -en "$(YELLOW)$(WARNING) Warning: This will remove all Docker images, volumes, and orphan containers! Are you sure? (y/N) $(RESET)\n"
	@read -r answer; if [ "$$answer" = "y" ]; then \
		$(DOCKER_COMPOSE) down --rmi all --volumes --remove-orphans; \
		echo -e "$(GREEN)$(OK) All Docker resources have been removed.$(RESET)"; \
	else \
		echo -e "$(YELLOW)$(WARNING) Operation cancelled.$(RESET)"; \
	fi

# ? 🔄 Rebuilds the Docker image and restarts the service
docker-re:
	@$(MAKE) configure-hooks > /dev/null
	@$(MAKE) docker-fclean $(NOPRINT)
	@$(MAKE) docker-build $(NOPRINT)
	@$(MAKE) docker-up $(NOPRINT)
	@echo -e "$(GREEN)$(OK) Docker service has been rebuilt and restarted!$(RESET)"

# ? 🔍 Runs the TypeScript linter
lint:
	@$(MAKE) configure-hooks > /dev/null
	@echo -en "$(BLUE)Running linter...$(RESET)"
	@pnpm run lint
	@echo -e "\n$(GREEN)$(OK) Linting completed successfully!$(RESET)"

# ? 🛠️  Fixes lint issues automatically when possible
lint-fix:
	@$(MAKE) configure-hooks > /dev/null
	@echo -en "$(BLUE)Running linter with auto-fix...$(RESET)"
	@pnpm run lint:fix
	@echo -e "\n$(GREEN)$(OK) Linting and auto-fixing completed successfully!$(RESET)"

# ? ✅ Runs the TypeScript type checker
typecheck:
	@$(MAKE) configure-hooks > /dev/null
	@echo -en "$(BLUE)Running TypeScript type check...$(RESET)"
	@pnpm run typecheck
	@echo -e "\n$(GREEN)$(OK) TypeScript type check completed successfully!$(RESET)"

# ? 🛡️  Runs the security audit
audit:
	@$(MAKE) configure-hooks > /dev/null
	@echo -e "$(BLUE)Running security audit...$(RESET)"
	@pnpm audit
	@echo -e "\n$(GREEN)$(OK) Security audit completed successfully!$(RESET)"

# ? 🔄 Updates git submodules
update:
	@$(MAKE) configure-hooks > /dev/null
	@echo -e "$(BLUE)Updating git submodules...$(RESET)"
	@git submodule update --remote --merge
	@echo -e "$(GREEN)$(OK) Submodules have been updated to their latest commits!$(RESET)"

# ? ❓ Displays this help message
help:
	@$(MAKE) configure-hooks > /dev/null
	@awk '\
		BEGIN { blue = "\033[0;34m"; green = "\033[0;32m"; reset = "\033[0m"; yellow = "\033[0;33m"; print yellow "Usage: make [target]"; print "Targets:" } \
		/^# \?/ { desc = substr($$0, 5); next } \
		/^$$/ { desc = ""; next } \
		/^[a-zA-Z0-9][a-zA-Z0-9_.-]*:/ { \
			target = $$1; \
			sub(/:.*/, "", target); \
			if (target !~ /^\./) \
				printf "  " blue "%-17s" reset green "%s" reset "\n", target, desc; \
			desc = ""; \
		}' $(firstword $(MAKEFILE_LIST)); \
