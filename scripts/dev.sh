#!/usr/bin/env bash
# ── Local dev: runs backend + dashboard without needing a K8s cluster ──────────
set -euo pipefail

echo "⚡ Industrial Edge Anomaly Sentinel — Local Dev Mode"
echo "   Uses mock data (no Prometheus/K8s required)"
echo ""

# Backend
echo "Starting backend API on :8000..."
pip install -r requirements.txt -q
export PROMETHEUS_URL="http://localhost:9090"  # Will fail gracefully → mock data
uvicorn backend.api.server:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 2

# Dashboard
echo "Starting dashboard on :3000..."
cd dashboard
npm install -q
VITE_API_URL="http://localhost:8000" npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "🌐 Dashboard: http://localhost:3000"
echo "📡 API:       http://localhost:8000"
echo "📋 API Docs:  http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"

cleanup() {
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo "Stopped."
}
trap cleanup EXIT INT TERM
wait
