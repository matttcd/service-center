@echo off
title El Gringo Celulares - API de desarrollo (:4000)
cd /d "%~dp0server"
set "PORT=4000"
npx nodemon index.js
