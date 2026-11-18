# Field-data experiment pipeline (Windows PowerShell)
# Usage:
#   .\scripts\run_field_pipeline.ps1 -InputJson .\data\raw\field_export.json

param(
  [Parameter(Mandatory = $true)]
  [string]$InputJson,
  [string]$Rates = "0.05,0.1,0.2"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "== Labeling progress =="
python scripts/labeling_progress.py --in $InputJson

Write-Host "== Dataset card =="
python scripts/dataset_card.py --in $InputJson

Write-Host "== Build train set (labeled only if available) =="
python scripts/build_train_set.py --in $InputJson --out data/raw/train_set.json

Write-Host "== Ablation =="
python scripts/run_ablation.py --in $InputJson --rates $Rates

Write-Host "== Figures =="
python scripts/plot_ablation.py

$ablation = Get-ChildItem data/synthetic/ablation_r*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($ablation) {
  Write-Host "== Supervised semi on $($ablation.Name) =="
  python scripts/detect_supervised.py --in $ablation.FullName --semi
  python scripts/eval_portrait_bias.py --data $ablation.FullName --scores data/results/supervised_semi_scores.json
}

Write-Host "Done. See data/results/"
