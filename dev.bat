@echo off
start "Vite" bash -c "cd %cd% && npm run dev"
start "Server" bash -c "cd %cd% && npm run dev:server"
start "Bridge" bash -c "cd %cd%/server/printer && python print_bridge.py"
