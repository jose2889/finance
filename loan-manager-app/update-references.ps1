# Script para actualizar referencias de SCSS a CSS
Get-ChildItem -Path "src" -Recurse -Filter "*.ts" | ForEach-Object {
    (Get-Content $_.FullName) -replace '\.scss', '.css' | Set-Content $_.FullName
} 