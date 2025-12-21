#!/bin/bash

# =============================================================================
# Brand Infinity Engine - Setup Script
# Description: Complete setup for the Brand Infinity Engine
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}Brand Infinity Engine - Initial Setup${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""

# =============================
# Step 1: Check Prerequisites
# =============================
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check for Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js found: $NODE_VERSION${NC}"
else
    echo -e "${RED}✗ Node.js not found${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check for npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm found: v$NPM_VERSION${NC}"
else
    echo -e "${RED}✗ npm not found${NC}"
    exit 1
fi

# Check for Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✓ Docker found: $DOCKER_VERSION${NC}"
else
    echo -e "${YELLOW}⚠ Docker not found${NC}"
    echo "Docker is recommended for easy PostgreSQL, Redis, and n8n setup"
    echo "Install from https://www.docker.com/get-started"
fi

# Check for Docker Compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_VERSION=$(docker-compose --version)
    echo -e "${GREEN}✓ Docker Compose found: $DOCKER_COMPOSE_VERSION${NC}"
else
    echo -e "${YELLOW}⚠ Docker Compose not found${NC}"
fi

echo ""

# =============================
# Step 2: Environment Setup
# =============================
echo -e "${YELLOW}Step 2: Setting up environment configuration...${NC}"

if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${RED}⚠ IMPORTANT: Please edit .env and add your API keys and credentials${NC}"
    echo ""
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# =============================
# Step 3: Install Dependencies
# =============================
echo -e "${YELLOW}Step 3: Installing Node.js dependencies...${NC}"

npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# =============================
# Step 4: Database Setup
# =============================
echo -e "${YELLOW}Step 4: Database setup...${NC}"

if command -v docker &> /dev/null; then
    read -p "Do you want to start PostgreSQL via Docker? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Starting PostgreSQL container...${NC}"
        docker-compose up -d postgres
        echo -e "${GREEN}✓ PostgreSQL container started${NC}"
        echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
        sleep 5
    fi
else
    echo -e "${YELLOW}Please ensure PostgreSQL is running and configured in .env${NC}"
fi

echo ""

# =============================
# Step 5: Run Migrations
# =============================
echo -e "${YELLOW}Step 5: Running database migrations...${NC}"

read -p "Do you want to run database migrations now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    bash scripts/migrations/run_migrations.sh
else
    echo -e "${YELLOW}⚠ Skipping migrations. Run 'npm run db:migrate' later${NC}"
fi

echo ""

# =============================
# Step 6: Summary
# =============================
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo -e "1. ${BLUE}Edit your .env file with actual API keys:${NC}"
echo -e "   ${YELLOW}nano .env${NC}"
echo ""
echo -e "2. ${BLUE}Start all services with Docker:${NC}"
echo -e "   ${YELLOW}npm run docker:up${NC}"
echo ""
echo -e "3. ${BLUE}Access n8n at:${NC}"
echo -e "   ${YELLOW}https://localhost:5678${NC}"
echo ""
echo -e "4. ${BLUE}Run database migrations (if skipped):${NC}"
echo -e "   ${YELLOW}npm run db:migrate${NC}"
echo ""
echo -e "5. ${BLUE}Seed test data:${NC}"
echo -e "   ${YELLOW}npm run db:seed${NC}"
echo ""
echo -e "6. ${BLUE}Deploy n8n workflows:${NC}"
echo -e "   ${YELLOW}npm run deploy:workflows${NC}"
echo ""
echo -e "${GREEN}For more information, see docs/SETUP_GUIDE.md${NC}"
echo ""
