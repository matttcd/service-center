@echo off
cd /d "%~dp0"
python server\printer\print_bridge.py --port 9200
pause
