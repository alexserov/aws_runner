#!/bin/bash

REPO_FULLNAME="REPO_FULLNAME_PLACEHOLDER"
WORKERS_COUNT="WORKERS_COUNT_PLACEHOLDER"
WORKERS_LABEL="WORKERS_LABEL_PLACEHOLDER"
AWS_ACCOUNT_ID="AWS_ACCOUNT_ID_PLACEHOLDER"
AWS_REGION="AWS_REGION_PLACEHOLDER"
DOCKER_REPO_NAME="DOCKER_REPO_NAME_PLACEHOLDER"
CONTROLLER_ADDRESS="CONTROLLER_ADDRESS_PLACEHOLDER"

cd /home/ubuntu/docker-host
npm ci
node .
