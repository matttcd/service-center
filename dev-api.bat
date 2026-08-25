@echo off
title El Gringo Celulares - API de desarrollo (:4000)
cd /d "%~dp0"
set "PORT=4000"
node server\index.js
