# Script para convertir archivos SCSS a CSS
Get-ChildItem -Path "src" -Recurse -Filter "*.scss" | ForEach-Object {
    $cssPath = $_.FullName -replace '\.scss$', '.css'
    Copy-Item $_.FullName $cssPath
    Remove-Item $_.FullName
} 