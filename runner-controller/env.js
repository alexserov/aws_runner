const { existsSync } = require('fs');
const path = require('path/posix');

require('dotenv').config({ path: path.resolve(__dirname, '../docker/.env') })

const exported = {
    ...(existsSync('./env.private.js') ? require('./env.private') : {}),
    ...{
        REPO_FULLNAME = process.env.REPO_FULLNAME,
        REPO_ROOT_TOKEN = process.env.REPO_ROOT_TOKEN,
        WORKERS_COUNT = process.env.WORKERS_COUNT,
        WORKERS_LABEL = process.env.WORKERS_LABEL,
        DOCKER_IMAGE = `${process.env.DOCKER_REGISTRY}/${process.env.DOCKER_REPO_NAME}:runner`,
        S_PORT = process.env.S_PORT,
        S_ENDPOINT = process.env.S_ENDPOINT,
    }
};
module.exports = exported;
