const { existsSync } = require('fs');
const { resolve } = require('path');
const exported = {
    ...{
        REPO_FULLNAME: process.env.REPO_FULLNAME,
        REPO_ROOT_TOKEN: process.env.REPO_ROOT_TOKEN,
        WORKERS_COUNT: process.env.WORKERS_COUNT,
        WORKERS_LABEL: process.env.WORKERS_LABEL,
        DOCKER_IMAGE: `${process.env.AWS_ACCOUNT_ID}.dkr.ecr.${process.env.AWS_REGION}.amazonaws.com/${process.env.DOCKER_REPO_NAME}:runner`,
        S_PORT: process.env.S_PORT,
        S_ENDPOINT: process.env.S_ENDPOINT,
    },
    ...(existsSync(resolve(__dirname,'../env.private.js')) ? require('../env.private') : {})
};
module.exports = exported;
