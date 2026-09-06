@echo off
wt.exe cmd /c "npm run dev" ; cmd /c "npm run dev:server" ; cmd /c "cd server\printer && python print_bridge.py"
