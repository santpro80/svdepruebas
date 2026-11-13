@echo off
title TERIAN ERP v3.0 Unificado - Villalba Hnos. Implantes S.A.
echo ========================================================================
echo   INICIANDO TERIAN ERP v3.0 UNIFICADO (COBOL + WEB)
echo   Directorio: D:\TERIAN-UNIFICADO\public
echo   URL Local : http://localhost:8090/sincronizador-erp.html
echo ========================================================================
cd /d "D:\TERIAN-UNIFICADO\public"
start "" "http://localhost:8090/sincronizador-erp.html"
npx --yes http-server -p 8090 -c-1
pause
