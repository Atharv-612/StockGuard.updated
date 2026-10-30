@echo off
set /p DB_PASSWORD="Enter MySQL root password: "
echo Starting StockGuard with MySQL...
java -jar target\stockguard-1.0.0.jar --spring.datasource.username=root --spring.datasource.password=%DB_PASSWORD%
pause
