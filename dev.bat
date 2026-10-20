@echo off
set "BASH=C:\Program Files\Git\bin\bash.exe"

wt.exe -p "Git Bash" -d "%cd%" -- "%BASH%" -l -c "./run-front.sh" ; split-pane -H -p "Git Bash" -d "%cd%\server" -- "%BASH%" -l -c "./run-server.sh" ; split-pane -V -p "Git Bash" -d "%cd%\server\printer" -- "%BASH%" -l -c "./run-printer.sh"