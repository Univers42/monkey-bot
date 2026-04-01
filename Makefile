SHELL := /bin/bash
.SHELLFLAGS := -ec

RED				:= \033[0;31m
GREEN			:= \033[0;32m
YELLOW			:= \033[0;33m
BLUE			:= \033[0;34m
MAGENTA			:= \033[0;35m
CYAN			:= \033[0;36m
RESET			:= \033[0m
DEFAULT_GOAL 	:= help
DOCKER_COMPOSE 	:= docker compose
OK				:= $(GREEN)🗸
WARNING			:= $(YELLOW)⚠
ERROR			:= $(RED)𐄂

HOOKS_DIR := vendor/scripts/hooks

# ? 🪝  Activate git hooks (auto-runs on make / make dev)
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

# ?  Checks for required dependencies (Node.js and pnpm/npm)
check-deps:
	@echo -e "$(CYAN)Checking dependencies...$(RESET)"
	@which docker > /dev/null && { echo -e "$(GREEN)$(OK) Docker is installed.$(RESET)"; } || { echo -e "$(RED)$(ERROR) Docker is not installed. Please install it to proceed.$(RESET)"; exit 1; }
	@which node > /dev/null && { echo -e "$(GREEN)$(OK) Node.js is installed.$(RESET)"; } || { echo -e "$(RED)$(ERROR) Node.js is not installed. Please install it to proceed.$(RESET)"; exit 1; }
	@which pnpm > /dev/null && { echo -e "$(GREEN)$(OK) pnpm is installed.$(RESET)"; } || { echo -e "$(RED)$(ERROR) pnpm is not installed. Please install it to proceed.$(RESET)"; exit 1; }
	@which npm > /dev/null && { echo -e "$(GREEN)$(OK) npm is installed.$(RESET)"; } || { echo -e "$(RED)$(ERROR) npm is not installed. Please install it to proceed.$(RESET)"; exit 1; }
	@echo -e
	@echo -e "$(GREEN)All dependencies are satisfied.$(RESET)"

# ? 🔨 Builds the Docker image
docker-build:
	@$(DOCKER_COMPOSE) build
	@echo -e "$(GREEN)$(OK) Docker image has been built successfully!$(RESET)"

# ? 🚀 Starts the Docker service in detached mode
docker-up:
	@$(DOCKER_COMPOSE) up -d
	@echo -e "$(GREEN)$(OK) Docker service is up and running!$(RESET)"
	@echo -e "$(CYAN) Visit http://localhost:3000 $(RESET)"

# ? 🗑️  Stops and removes the Docker service, network, volumes, and local images
docker-remove:
	@$(DOCKER_COMPOSE) down --rmi local --volumes --remove-orphans
	@echo -e "$(GREEN)$(OK) Docker service has been removed.$(RESET)"

# ? 🛑  Stops the Docker service and removes containers and networks
docker-down:
	@$(DOCKER_COMPOSE) down
	@echo -e "$(GREEN)$(OK) Docker service has been stopped and containers removed.$(RESET)"

# ? 🧹  Stops the Docker service and removes all images, volumes, and orphan containers
docker-fclean:
	@echo -en "$(YELLOW)$(WARNING) Warning: This will remove all Docker images, volumes, and orphan containers!$(RESET)\n"
	@$(DOCKER_COMPOSE) down --rmi all --volumes --remove-orphans
	@echo -e "$(GREEN)$(OK) All Docker resources have been removed.$(RESET)"

# ? 🔍  Runs the TypeScript linter
lint:
	@echo -en "$(BLUE)Running linter...$(RESET)"
	@pnpm run lint
	@echo -e "\n$(GREEN)$(OK) Linting completed successfully!$(RESET)"

# ? 🛠️  Fixes lint issues automatically when possible
lint-fix:
	@echo -en "$(BLUE)Running linter with auto-fix...$(RESET)"
	@pnpm run lint:fix
	@echo -e "\n$(GREEN)$(OK) Linting and auto-fixing completed successfully!$(RESET)"

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