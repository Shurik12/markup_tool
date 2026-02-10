# Markup Tool Makefile
# Usage: make [target]

.PHONY: help setup backend frontend install run clean postgresql

# Colors for output
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[0;33m
BLUE=\033[0;34m
NC=\033[0m # No Color

# Default target
.DEFAULT_GOAL := help

help: ## Display this help message with categorized commands
	@echo "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
	@echo "${CYAN}║                MARKUP TOOL - MAKE COMMANDS               ║${NC}"
	@echo "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
	@echo ""
	@echo "${YELLOW}📦 INSTALLATION:${NC}"
	@echo "  ${GREEN}install${NC}               - Install all dependencies (backend + frontend)"
	@echo "  ${GREEN}install-backend${NC}       - Install Python backend dependencies"
	@echo "  ${GREEN}install-frontend${NC}      - Install Node.js frontend dependencies"
	@echo ""
	@echo "${YELLOW}🚀 DEVELOPMENT:${NC}"
	@echo "  ${GREEN}run${NC}                   - Run the Flask backend server"
	@echo "  ${GREEN}dev${NC}                   - Run development environment"
	@echo "  ${GREEN}build${NC}                 - Build frontend for production"
	@echo ""
	@echo "${YELLOW}🧹 CLEANUP:${NC}"
	@echo "  ${GREEN}clean${NC}                 - Clean Python cache files"
	@echo "  ${GREEN}clean-frontend${NC}        - Clean frontend node_modules and build"
	@echo "  ${GREEN}clean-backend${NC}         - Clean backend virtualenv and uploads"
	@echo "  ${GREEN}clean-all${NC}             - Clean everything"
	@echo ""
	@echo "${YELLOW}🔍 CODE QUALITY:${NC}"
	@echo "  ${GREEN}lint${NC}                  - Lint both backend and frontend"
	@echo "  ${GREEN}lint-backend${NC}          - Lint Python code with flake8"
	@echo "  ${GREEN}format${NC}                - Format both backend and frontend"
	@echo "  ${GREEN}format-backend${NC}        - Format Python code with black"
	@echo "  ${GREEN}format-frontend${NC}       - Format frontend code with prettier"
	@echo ""
	@echo "${YELLOW}🐳 DOCKER:${NC}"
	@echo "  ${GREEN}docker-start${NC}          - Start services with Docker Compose"
	@echo "  ${GREEN}docker-stop${NC}           - Stop Docker services"
	@echo "  ${GREEN}docker-clean${NC}          - Remove Docker containers and volumes"
	@echo ""
	@echo "${YELLOW}📊 DATABASE:${NC}"
	@echo "  ${GREEN}postgresql${NC}            - Open PostgreSQL interactive terminal"
	@echo "  ${GREEN}init-db${NC}               - Initialize database tables"
	@echo ""
	@echo "${CYAN}────────────────────────────────────────────────────────────${NC}"
	@echo "Usage: make ${YELLOW}<target>${NC}"
	@echo "Example: make ${GREEN}install${NC}"
	@echo "${CYAN}────────────────────────────────────────────────────────────${NC}"
	
install-backend:
	@echo "${YELLOW}Installing Python dependencies...${NC}"
	cd backend && pip install -r requirements.txt
	@echo "${GREEN}✅ Backend dependencies installed${NC}"

install-frontend:
	@echo "${YELLOW}Installing Node.js dependencies...${NC}"
	cd frontend && npm install
	@echo "${GREEN}✅ Frontend dependencies installed${NC}"

run:
	cd backend && python3 app.py

build:
	cd frontend && npm run build

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +

clean-frontend:
	rm -rf frontend/node_modules
	rm -rf frontend/build
	rm -f frontend/package-lock.json

clean-backend:
	rm -rf backend/venv
	rm -rf backend/uploads/*

postgresql:
	sudo -u postgres psql

lint-backend: ## Lint Python code
	@echo "${YELLOW}Linting Python code...${NC}"
	cd backend && python3 -m flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
	cd backend && python3 -m flake8 . --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics
	@echo "${GREEN}Python linting complete${NC}"

format-backend:
	@echo "${YELLOW}Formatting Python code...${NC}"
	cd backend && python3 -m black .
	@echo "${GREEN}Python formatting complete${NC}"

format-frontend: ## Format JavaScript/React code with prettier
	@echo "${YELLOW}Formatting frontend code...${NC}"
	cd frontend && npx prettier --write "src/**/*.{js,jsx,ts,tsx,json,css,scss,md}"
	@echo "${GREEN}Frontend formatting complete${NC}"

format: format-backend format-frontend