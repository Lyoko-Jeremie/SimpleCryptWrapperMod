
cd /d %~dp0

node "encryptTool.js" "cryptModConfig.json" "bootTemplate.json" %1

pause
