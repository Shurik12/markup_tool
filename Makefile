# Markup Tool Makefile
# Usage: make [target]

.PHONY: help setup backend frontend install run clean

# Colors for output
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[0;33m
BLUE=\033[0;34m
NC=\033[0m # No Color

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Markup Tool - Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  ${GREEN}%-15s${NC} %s\n", $$1, $$2}'

# ====================
# SETUP & INSTALLATION
# ====================

setup: ## Complete project setup (backend + frontend)
	@echo "${BLUE}🚀 Setting up Markup Tool project...${NC}"
	@echo ""
	@echo "${YELLOW}Installing backend dependencies...${NC}"
	$(MAKE) install-backend
	@echo ""
	@echo "${YELLOW}Installing frontend dependencies...${NC}"
	$(MAKE) install-frontend
	@echo ""
	@echo "${GREEN}✅ Setup complete!${NC}"
	@echo ""
	@echo "To start the application:"
	@echo "  ${YELLOW}make run${NC}           # Start both backend and frontend"
	@echo "  ${YELLOW}make backend${NC}       # Start backend only"
	@echo "  ${YELLOW}make frontend${NC}      # Start frontend in dev mode"

install-backend:
	@echo "${YELLOW}Installing Python dependencies...${NC}"
	cd backend && pip install -r requirements.txt
	@echo "${GREEN}✅ Backend dependencies installed${NC}"

install-frontend:
	@echo "${YELLOW}Installing Node.js dependencies...${NC}"
	cd frontend && npm install
	@echo "${GREEN}✅ Frontend dependencies installed${NC}"

# ====================
# DEVELOPMENT
# ====================

run:
	cd backend && python3 app.py

build-frontend:
	@echo "${BLUE}Building React frontend for production...${NC}"
	cd frontend && npm run build
	@echo "${GREEN}✅ Frontend built in frontend/dist/${NC}"

# ====================
# CLEANUP
# ====================

clean: pycache clean-frontend
	@echo "${GREEN}Project cleaned${NC}"

clean-pycache:
	@echo "${YELLOW}Cleaning Python cache files...${NC}"
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.pyd" -delete
	find . -type f -name ".coverage" -delete
	@echo "${GREEN}Python cache cleaned${NC}"

clean-frontend:
	@echo "${YELLOW}Cleaning frontend artifacts...${NC}"
	rm -rf frontend/node_modules
	rm -rf frontend/build
	rm -rf frontend/.next
	rm -f frontend/package-lock.json
	rm -f frontend/yarn.lock
	@echo "${GREEN}Frontend cleaned${NC}"

clean-backend:
	@echo "${YELLOW}Cleaning backend artifacts...${NC}"
	rm -rf backend/venv
	rm -rf backend/uploads/*
	@echo "${GREEN} Backend cleaned${NC}"

# ====================
# CODE QUALITY
# ====================

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

# ====================
# PROJECT INFO
# ====================

status: ## Show project status
	@echo "${BLUE}=== Markup Tool Project Status ===${NC}"
	@echo ""
	@echo "${YELLOW}Backend:${NC}"
	@cd backend && python --version 2>/dev/null || echo "Python not found"
	@cd backend && [ -f requirements.txt ] && echo "✅ requirements.txt exists" || echo "❌ requirements.txt missing"
	@echo ""
	@echo "${YELLOW}Frontend:${NC}"
	@cd frontend && [ -f package.json ] && echo "✅ package.json exists" || echo "❌ package.json missing"
	@cd frontend && [ -d node_modules ] && echo "✅ node_modules exists" || echo "❌ node_modules missing"
	@echo ""
	@echo "${YELLOW}Database:${NC}"
	@curl -s http://localhost:5000/api/health 2>/dev/null | grep -q "healthy" && echo "✅ Backend is healthy" || echo "❌ Backend not responding"
	@echo ""
	@echo "${YELLOW}Quick Start:${NC}"
	@echo "  make setup          # Install dependencies"
	@echo "  make backend        # Start backend"
	@echo "  make frontend       # Start frontend dev"
	@echo "  make run-production # Production mode"