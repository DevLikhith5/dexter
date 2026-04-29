#!/bin/bash

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                     DEXTER - UNIFIED START SCRIPT                            ║
# ║  Starts: Postgres | Redis | Neo4j | GraphRAG Python | Backend | Frontend     ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

set -e

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ── Configuration ──
POSTGRES_PORT=5440
REDIS_PORT=6389
NEO4J_BOLT_PORT=7687
NEO4J_HTTP_PORT=7474
GRAPH_RAG_PORT=8000
BACKEND_PORT=3001
FRONTEND_PORT=3000

GRAPH_RAG_DIR="graph_rag"
BACKEND_DIR="backend"
FRONTEND_DIR="web"
VENV_DIR="$GRAPH_RAG_DIR/.venv"

# ── Helpers ──
log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_err()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${BOLD}${CYAN}▶ $1${NC}"; }
log_svc()   { echo -e "${MAGENTA}[SVC]${NC}   $1"; }

port_open() {
    nc -z localhost "$1" 2>/dev/null
}

wait_for_service() {
    local name=$1 port=$2 max_wait=${3:-60}
    local waited=0
    log_info "Waiting for $name on port $port..."
    while ! port_open "$port"; do
        sleep 1
        waited=$((waited + 1))
        if [ "$waited" -ge "$max_wait" ]; then
            log_err "$name failed to start on port $port after ${max_wait}s"
            return 1
        fi
    done
    log_ok "$name is ready on port $port (${waited}s)"
}

# ── Pre-flight checks ──
log_step "Pre-flight Checks"

if ! command -v docker &> /dev/null; then
    log_err "Docker is not installed or not in PATH"
    exit 1
fi

if ! command -v bun &> /dev/null; then
    log_err "bun is not installed. Install from https://bun.sh"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    log_err "python3 is not installed"
    exit 1
fi

log_ok "Pre-flight checks passed"

# ── Docker Infrastructure ──
log_step "Starting Docker Infrastructure (Postgres, Redis, Neo4j)"

docker-compose up -d

wait_for_service "PostgreSQL" "$POSTGRES_PORT" 60
wait_for_service "Redis" "$REDIS_PORT" 30
wait_for_service "Neo4j Bolt" "$NEO4J_BOLT_PORT" 60

# Give Neo4j a bit more time to fully initialize plugins
sleep 3
log_ok "All Docker containers are healthy"

# ── Python Virtual Environment ──
log_step "Setting up Graph RAG Python Environment"

if [ ! -d "$VENV_DIR" ]; then
    log_info "Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate venv for this script
source "$VENV_DIR/bin/activate"

if [ ! -f "$GRAPH_RAG_DIR/requirements.txt" ]; then
    log_err "requirements.txt not found in $GRAPH_RAG_DIR"
    exit 1
fi

# Check if key packages are installed, if not install all
if ! python -c "import fastapi, neo4j, langchain" 2>/dev/null; then
    log_info "Installing Python dependencies..."
    pip install -q --upgrade pip
    pip install -q -r "$GRAPH_RAG_DIR/requirements.txt"
    log_ok "Python dependencies installed"
else
    log_ok "Python dependencies already satisfied"
fi

# ── Backend Dependencies ──
log_step "Setting up Backend (Bun)"

cd "$BACKEND_DIR"

if [ ! -d "node_modules" ]; then
    log_info "Installing backend dependencies with bun..."
    bun install
    log_ok "Backend dependencies installed"
else
    log_ok "Backend dependencies already present"
fi

# ── Run DB Migrations ──
log_step "Running Database Migrations"

if bun run db:migrate 2>/dev/null; then
    log_ok "Database migrations applied"
else
    log_warn "Migration command not available or already up-to-date"
fi

cd ..

# ── Frontend Dependencies ──
log_step "Setting up Frontend (Vite)"

cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
    log_info "Installing frontend dependencies with bun..."
    bun install
    log_ok "Frontend dependencies installed"
else
    log_ok "Frontend dependencies already present"
fi

cd ..

# ── Cleanup Handler ──
cleanup() {
    echo ""
    log_step "Shutting down all services..."

    # Kill background jobs (frontend, backend, graph_rag)
    local jobs_pids=$(jobs -p)
    if [ -n "$jobs_pids" ]; then
        kill $jobs_pids 2>/dev/null || true
        wait $jobs_pids 2>/dev/null || true
    fi

    log_ok "All background services stopped"
    log_info "Docker containers are still running. Run 'docker-compose down' to stop them."
    exit 0
}

trap cleanup INT TERM EXIT

# ── Start Services ──
log_step "Starting Application Services"

# 1. Graph RAG Python Service
cd "$GRAPH_RAG_DIR"
log_svc "Starting Graph RAG AI Worker on port $GRAPH_RAG_PORT..."
uvicorn app.main:app --host 0.0.0.0 --port "$GRAPH_RAG_PORT" --reload &
cd ..
wait_for_service "Graph RAG" "$GRAPH_RAG_PORT" 30

# 2. Backend API
cd "$BACKEND_DIR"
log_svc "Starting Backend API on port $BACKEND_PORT..."
bun --hot src/index.ts &
cd ..
wait_for_service "Backend API" "$BACKEND_PORT" 30

# 3. Frontend Vite
cd "$FRONTEND_DIR"
log_svc "Starting Frontend Vite on port $FRONTEND_PORT..."
bun run dev &
cd ..
wait_for_service "Frontend" "$FRONTEND_PORT" 30

# ── Summary ──
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║                     ✅ ALL SERVICES ARE RUNNING!                             ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}PostgreSQL${NC}  →  localhost:${POSTGRES_PORT}"
echo -e "  ${CYAN}Redis${NC}       →  localhost:${REDIS_PORT}"
echo -e "  ${CYAN}Neo4j${NC}       →  localhost:${NEO4J_BOLT_PORT}  (Browser: http://localhost:${NEO4J_HTTP_PORT})"
echo -e "  ${MAGENTA}Graph RAG${NC}   →  http://localhost:${GRAPH_RAG_PORT}"
echo -e "  ${MAGENTA}Backend${NC}     →  http://localhost:${BACKEND_PORT}"
echo -e "  ${MAGENTA}Frontend${NC}    →  http://localhost:${FRONTEND_PORT}"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Keep script alive
wait
