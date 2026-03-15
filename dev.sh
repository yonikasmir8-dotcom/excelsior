#!/bin/bash
# ⚡ EXCELSIOR! — Local dev launcher
# Runs backend and frontend in parallel, kills both on Ctrl+C

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo ""
echo -e "${RED}  ███████╗██╗  ██╗ ██████╗███████╗██╗     ███████╗██╗ ██████╗ ██████╗ ${NC}"
echo -e "${YELLOW}  ██╔════╝╚██╗██╔╝██╔════╝██╔════╝██║     ██╔════╝██║██╔═══██╗██╔══██╗${NC}"
echo -e "${RED}  █████╗   ╚███╔╝ ██║     █████╗  ██║     ███████╗██║██║   ██║██████╔╝${NC}"
echo -e "${YELLOW}  ██╔══╝   ██╔██╗ ██║     ██╔══╝  ██║     ╚════██║██║██║   ██║██╔══██╗${NC}"
echo -e "${RED}  ███████╗██╔╝ ██╗╚██████╗███████╗███████╗███████║██║╚██████╔╝██║  ██║${NC}"
echo -e "${YELLOW}  ╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚══════╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝${NC}"
echo ""
echo -e "${GREEN}  ⚡ Comic Book Tracker — Starting dev environment...${NC}"
echo ""

# Check for .env files
if [ ! -f "backend/.env" ]; then
  echo -e "${RED}  ✗ backend/.env not found!${NC}"
  echo "    Copy backend/.env.example to backend/.env and fill in your keys."
  echo ""
  exit 1
fi

if [ ! -f "frontend/.env" ]; then
  echo -e "${RED}  ✗ frontend/.env not found!${NC}"
  echo "    Copy frontend/.env.example to frontend/.env and fill in your keys."
  echo ""
  exit 1
fi

# Install dependencies if node_modules missing
if [ ! -d "backend/node_modules" ]; then
  echo -e "${YELLOW}  → Installing backend dependencies...${NC}"
  (cd backend && npm install)
fi

if [ ! -d "frontend/node_modules" ]; then
  echo -e "${YELLOW}  → Installing frontend dependencies...${NC}"
  (cd frontend && npm install)
fi

# Start both in parallel
echo -e "${GREEN}  → Starting backend on http://localhost:3001${NC}"
echo -e "${GREEN}  → Starting frontend on http://localhost:5173${NC}"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

# Trap Ctrl+C and kill both processes
cleanup() {
  echo ""
  echo -e "${YELLOW}  Shutting down...${NC}"
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit 0
}
trap cleanup INT TERM

# Run both
(cd backend && node server.js) &
BACKEND_PID=$!

(cd frontend && npm run dev) &
FRONTEND_PID=$!

# Wait for either to exit
wait $BACKEND_PID $FRONTEND_PID
