#!/bin/bash

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                     DEXTER - UNIFIED STOP SCRIPT                             ║
# ║  Stops: GraphRAG Python | Backend | Frontend | Docker (optional)             ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_err()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${BOLD}▶ $1${NC}"; }

# ── Kill dev processes ──
log_step "Stopping application services"

# Find and kill uvicorn (Graph RAG)
UVICORN_PIDS=$(pgrep -f "uvicorn app.main:app" || true)
if [ -n "$UVICORN_PIDS" ]; then
    log_info "Stopping Graph RAG (uvicorn)..."
    kill $UVICORN_PIDS 2>/dev/null || true
    log_ok "Graph RAG stopped"
else
    log_warn "Graph RAG not running"
fi

# Find and kill bun backend
BUN_BACKEND_PIDS=$(pgrep -f "bun --hot src/index.ts" || true)
if [ -n "$BUN_BACKEND_PIDS" ]; then
    log_info "Stopping Backend API (bun)..."
    kill $BUN_BACKEND_PIDS 2>/dev/null || true
    log_ok "Backend API stopped"
else
    log_warn "Backend API not running"
fi

# Find and kill vite frontend
VITE_PIDS=$(pgrep -f "vite" || true)
if [ -n "$VITE_PIDS" ]; then
    log_info "Stopping Frontend (vite)..."
    kill $VITE_PIDS 2>/dev/null || true
    log_ok "Frontend stopped"
else
    log_warn "Frontend not running"
fi

# ── Docker ──
echo ""
read -p "Stop Docker containers (Postgres, Redis, Neo4j) too? [y/N]: " answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
    log_step "Stopping Docker containers"
    docker-compose down
    log_ok "Docker containers stopped"
else
    log_info "Docker containers left running"
fi

echo ""
echo -e "${GREEN}✅ All requested services have been stopped.${NC}"
echo ""
