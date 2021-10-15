#!/bin/bash

docker pull ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${DOCKER_REPO_NAME}:runner;

cleanup() {
    curl -X POST 127.0.0.1:${S_PORT}/${S_ENDPOINT}
}

trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

dockerd &
node ./docker-host/index.js
