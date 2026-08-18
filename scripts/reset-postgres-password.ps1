$ErrorActionPreference = "Stop"
$dataDir = "C:\Program Files\PostgreSQL\17\data"
$hba = "$dataDir\pg_hba.conf"
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$service = "postgresql-x64-17"

Copy-Item $hba "$hba.bak" -Force
(Get-Content $hba) -replace "scram-sha-256", "trust" | Set-Content $hba

Restart-Service $service -Force
Start-Sleep -Seconds 3

$env:PGPASSWORD = ""
& $psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"

Copy-Item "$hba.bak" $hba -Force
Remove-Item "$hba.bak"

Restart-Service $service -Force
Start-Sleep -Seconds 3

Write-Host "Listo. Password de 'postgres' seteado a 'postgres' (solo dev local)." -ForegroundColor Green
