Push-Location .\docker

docker compose build
(Get-ECRLoginCommand).Password | docker login --username AWS --password-stdin $env:AWS_ACCOUNT_ID.dkr.ecr.$env:AWS_REGION.amazonaws.com
docker compose push

Pop-Location
