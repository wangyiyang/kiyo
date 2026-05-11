SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

.DEFAULT_GOAL := help

SUPABASE_WORKDIR ?= supabase-local
SUPABASE_PROJECT_DIR ?= $(SUPABASE_WORKDIR)/supabase
SUPABASE_MIGRATIONS ?= $(SUPABASE_WORKDIR)/migrations
SUPABASE_CLI := npx supabase --workdir $(SUPABASE_WORKDIR)
ENV_FILE ?= supabase/.env
BACKUP_ROOT ?= /home/kk/supabase-backups/kiyo

define load_remote_password
password=$$(awk 'BEGIN{found=0} /^[[:space:]]*SUPABASE_DB_PASSWORD[[:space:]]*=/{sub(/^[[:space:]]*SUPABASE_DB_PASSWORD[[:space:]]*=[[:space:]]*/, ""); print; found=1; exit} END{if(!found) exit 2}' "$(ENV_FILE)"); \
password=$${password%$$'\r'}; \
if [[ "$$password" == \"*\" && "$$password" == *\" ]]; then password=$${password:1:$${#password}-2}; fi; \
if [[ "$$password" == \'*\' && "$$password" == *\' ]]; then password=$${password:1:$${#password}-2}; fi; \
test -n "$$password"; \
export SUPABASE_DB_PASSWORD="$$password";
endef

.PHONY: help
help:
	@echo "Kiyo 数据库迁移常用命令"
	@echo ""
	@echo "准备:"
	@echo "  make db-doctor                 修复 Supabase CLI 本地迁移目录软链接"
	@echo "  make supabase-start            启动本地 Supabase"
	@echo "  make supabase-status           查看本地 Supabase 状态"
	@echo ""
	@echo "新建和本地验证:"
	@echo "  make db-new name=create_xxx    新建迁移文件"
	@echo "  make db-backup-local           备份本地数据库 schema"
	@echo "  make db-push-local-dry-run     本地迁移 dry-run"
	@echo "  make db-push-local             应用本地迁移"
	@echo "  make db-reset-local            重置本地库并重放迁移"
	@echo "  make db-gen-types              生成 Supabase TypeScript 类型"
	@echo ""
	@echo "远程迁移:"
	@echo "  make db-list-remote            查看远程迁移历史"
	@echo "  make db-backup-remote          备份远程 roles/schema/data"
	@echo "  make db-push-remote-dry-run    远程迁移 dry-run"
	@echo "  make db-push-remote            推送远程迁移"
	@echo "  make db-migrate-remote         一键备份 + dry-run + push + 列历史"
	@echo "  make db-verify-remote          验证远程已无待推迁移"
	@echo ""
	@echo "远程密码:"
	@echo "  在 $(ENV_FILE) 中配置 SUPABASE_DB_PASSWORD=..."

.PHONY: db-doctor
db-doctor:
	@mkdir -p "$(SUPABASE_PROJECT_DIR)"
	@if [ -e "$(SUPABASE_PROJECT_DIR)/migrations" ] && [ ! -L "$(SUPABASE_PROJECT_DIR)/migrations" ]; then \
		echo "错误: $(SUPABASE_PROJECT_DIR)/migrations 已存在且不是软链接"; \
		echo "请手工检查后再执行，避免覆盖本地文件。"; \
		exit 1; \
	fi
	@ln -sfn ../migrations "$(SUPABASE_PROJECT_DIR)/migrations"
	@test -d "$(SUPABASE_MIGRATIONS)"
	@echo "OK: $(SUPABASE_PROJECT_DIR)/migrations -> ../migrations"

.PHONY: supabase-start
supabase-start:
	@$(SUPABASE_CLI) start

.PHONY: supabase-status
supabase-status:
	@$(SUPABASE_CLI) status

.PHONY: db-new
db-new: db-doctor
	@if [ -z "$(name)" ]; then \
		echo "用法: make db-new name=create_example_table"; \
		exit 1; \
	fi
	@$(SUPABASE_CLI) migration new "$(name)"

.PHONY: db-list-local
db-list-local: db-doctor
	@$(SUPABASE_CLI) migration list --local

.PHONY: db-list-remote
db-list-remote: db-doctor
	@$(load_remote_password) \
	$(SUPABASE_CLI) migration list --linked

.PHONY: db-backup-local
db-backup-local:
	@ts=$$(date +%Y%m%d-%H%M%S); \
	backup_dir="$(BACKUP_ROOT)/local-before-migration-$$ts"; \
	mkdir -p "$$backup_dir"; \
	$(SUPABASE_CLI) db dump --local -f "$$backup_dir/schema.sql"; \
	echo "LOCAL_BACKUP_DIR=$$backup_dir"

.PHONY: db-backup-remote
db-backup-remote: db-doctor
	@ts=$$(date +%Y%m%d-%H%M%S); \
	backup_dir="$(BACKUP_ROOT)/remote-before-migration-$$ts"; \
	mkdir -p "$$backup_dir"; \
	$(load_remote_password) \
	$(SUPABASE_CLI) db dump --linked --role-only -f "$$backup_dir/roles.sql"; \
	$(SUPABASE_CLI) db dump --linked -f "$$backup_dir/schema.sql"; \
	$(SUPABASE_CLI) db dump --linked --data-only --use-copy -f "$$backup_dir/data.sql"; \
	ls -lh "$$backup_dir"; \
	echo "REMOTE_BACKUP_DIR=$$backup_dir"

.PHONY: db-push-local-dry-run
db-push-local-dry-run: db-doctor
	@$(SUPABASE_CLI) db push --local --include-all --dry-run

.PHONY: db-push-local
db-push-local: db-doctor
	@$(SUPABASE_CLI) db push --local --include-all --yes

.PHONY: db-reset-local
db-reset-local: db-doctor
	@$(SUPABASE_CLI) db reset

.PHONY: db-gen-types
db-gen-types:
	@$(SUPABASE_CLI) gen types typescript --local > packages/supabase/src/database.types.ts

.PHONY: db-push-remote-dry-run
db-push-remote-dry-run: db-doctor
	@$(load_remote_password) \
	$(SUPABASE_CLI) db push --linked --dry-run

.PHONY: db-push-remote
db-push-remote: db-doctor
	@$(load_remote_password) \
	$(SUPABASE_CLI) db push --linked --yes

.PHONY: db-migrate-remote
db-migrate-remote: db-backup-remote db-push-remote-dry-run db-push-remote db-list-remote

.PHONY: db-verify-remote
db-verify-remote: db-push-remote-dry-run

.PHONY: check
check:
	@pnpm type-check
	@git diff --check
