#!/bin/bash

CONTROLLER_ADDRESS=$(curl http://169.254.169.254/latest/meta-data/local-hostname)

node /home/ubuntu/controllers/controller-internal &
node /home/ubuntu/controllers/controller-public &
