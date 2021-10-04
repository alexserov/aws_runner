#!/bin/bash

node --version
npm --version

DATA=$(echo $1 | base64 -d)
TARGET_URL=$(echo ${DATA} | jq -r .url)
TARGET_TOKEN=$(echo ${DATA} | jq -r .token)
TARGET_TYPE=$(echo ${DATA} | jq -r .type)
TARGET_NAME=$(echo ${DATA} | jq -r .name)
HOST_PORT=$(echo ${DATA} | jq -r .port)

mkdir runners
cd actions-runner

#configure runner
echo $TARGET_NAME
./config.sh --url $TARGET_URL \
            --token $TARGET_TOKEN \
            --unattended \
            --replace \
            --name $TARGET_NAME \
            --labels $TARGET_TYPE \
            --ephemeral #https://docs.github.com/en/actions/hosting-your-own-runners/autoscaling-with-self-hosted-runners#using-ephemeral-runners-for-autoscaling

cleanup() {
    echo "Removing runner..."
    ./config.sh remove --unattended --token $(curl host.docker.internal:${HOST_PORT}/removeToken)
}

trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

./run.sh & wait $!
