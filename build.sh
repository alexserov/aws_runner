pushd docker

echo "Building images"
docker compose build

echo "AWS Login"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

echo "Pushing images"
docker compose push

popd
