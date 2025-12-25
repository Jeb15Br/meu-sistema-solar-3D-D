# Script para mover a pasta .gemini para o OneDrive
# ATENÇÃO: Isso pode interromper a IA se executado enquanto ela estiver ativa.

$SourcePath = "C:\Users\judah\.gemini"
$DestPath = "c:\Users\judah\OneDrive\Diversos\Trabalhos\Antigravity\gemini_backup_$(Get-Date -Format 'yyyyMMdd-HHmm')"

Write-Host "=========================================="
Write-Host "INICIANDO TRANSFERÊNCIA DE DADOS DA IA"
Write-Host "De: $SourcePath"
Write-Host "Para: $DestPath"
Write-Host "=========================================="

if (-not (Test-Path $SourcePath)) {
    Write-Error "A pasta de origem $SourcePath não foi encontrada!"
    exit
}

# Criar pasta de destino
if (-not (Test-Path $DestPath)) {
    New-Item -ItemType Directory -Force -Path $DestPath | Out-Null
    Write-Host "Pasta de destino criada com sucesso."
}

# Usar Robocopy para uma transferência mais robusta (preserva timestamps e lida melhor com arquivos)
# /E = Copia subpastas (inclusive vazias)
# /MOVE = Move arquivos e pastas (apaga da origem após copiar)
# /R:3 = Tenta 3 vezes se falhar
# /W:1 = Espera 1 segundo entre tentativas
$RoboArgs = @($SourcePath, $DestPath, "/E", "/MOVE", "/R:3", "/W:1", "/NFL", "/NDL")
Start-Process -FilePath "robocopy" -ArgumentList $RoboArgs -NoNewWindow -Wait

Write-Host ""
Write-Host "=========================================="
Write-Host "OPERAÇÃO CONCLUÍDA"
Write-Host "IMPORTANTE:"
Write-Host "1. A pasta .gemini foi movida para o seu OneDrive."
Write-Host "2. Como o OneDrive TAMBÉM fica no disco C:, o espaço AINDA NÃO FOI LIBERADO."
Write-Host "3. Para liberar os 15GB, vá na pasta '$DestPath', clique com o botão direito e selecione 'Liberar espaço' (Free up space)."
Write-Host "=========================================="
Pause
