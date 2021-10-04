Push-Location .\docker

docker compose build

(Get-ECRLoginCommand).Password | docker login --username AWS --password-stdin $env:AWS_ACCOUNT_ID.dkr.ecr.$env:AWS_REGION.amazonaws.com
docker tag $env:REPO_NAME:latest $env:AWS_ACCOUNT_ID.dkr.ecr.$env:AWS_REGION.amazonaws.com/$env:REPO_NAME:latest
docker push $env:AWS_ACCOUNT_ID.dkr.ecr.$env:AWS_REGION.amazonaws.com/$env:REPO_NAME:latest

Pop-Location
