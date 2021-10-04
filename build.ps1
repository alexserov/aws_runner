Push-Location .\docker

Write-Host "Building images"
docker compose build

Write-Host "AWS login"
$hostaddress = $env:AWS_ACCOUNT_ID+".dkr.ecr."+$env:AWS_REGION+".amazonaws.com"
(Get-ECRLoginCommand).Password | docker login --username AWS --password-stdin $hostaddress

Write-Host "Pushing images"
docker compose push

Pop-Location
