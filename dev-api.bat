@echo off
title El Gringo Celulares - API de desarrollo (:3001)
cd /d "%~dp0"
set "PORT=3001"
node server\index.js
