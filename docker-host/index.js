const Express = require('express');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { promisify } = require('util');
const axios = require('axios');
const config = require('../config');

const DOCKER_IMAGE = `${process.env.AWS_ACCOUNT_ID}.dkr.ecr.${process.env.AWS_REGION}.amazonaws.com/${process.env.DOCKER_REPO_NAME}:runner`;

let destroy = false;
const containers = [];

function getTokenImpl(endpointPart) {
    return axios({
        url: `http://${process.env.CONTROLLER_ADDRESS}:${config.constants.vpc.ports.controllerPrivate}/${endpointPart}`,
        method: 'GET',
    }).then((x) => x.data);
}

function getRegistrationToken() {
    return getTokenImpl('request_registration_token');
}
function getRemoveToken() {
    return getTokenImpl('request_remove_token');
}

async function startWorker() {
    while (!destroy) {
        const name = uuidv4().substr(0, 8);
        // eslint-disable-next-line no-await-in-loop
        const token = await getRegistrationToken();
        containers.push(name);
        const data = {
            url: `https://github.com/${process.env.REPO_FULLNAME}`,
            token,
            type: process.env.WORKERS_LABEL,
            name: `${process.env.WORKERS_LABEL}-${name}`,
            count: +process.env.WORKERS_COUNT,
            port: 35123,
        };
        const base64String = Buffer.from(JSON.stringify(data)).toString('base64');
        // eslint-disable-next-line no-await-in-loop
        await promisify(exec)(`docker run --name ${name} ${DOCKER_IMAGE} ${base64String}`)
            .catch((x) => {
                if (x.code === 137 || x.code === 143) return;
                throw (x);
            });
    }
}

async function startWorkers() {
    await Promise.all([...new Array(+process.env.WORKERS_COUNT).keys()].map(startWorker));
}

const stopAndDestroy = async (containerName) => {
    try {
        await promisify(exec)(`docker stop -t ${15 * 60} ${containerName}`);
        await promisify(exec)(`docker rm ${containerName}`);
    } catch {
        console.log(`Runner ${containerName} does not exist`);
    }
};

async function destroyRunners() {
    destroy = true;
    await Promise.all(containers.map(stopAndDestroy));
}

function main() {
    let server;

    const app = new Express();
    app.post('/kill', async (req, res) => {
        await destroyRunners();
        res.set(200).send();
        server.close();
    });
    app.get('/removeToken', async (req, res) => {
        const result = await getRemoveToken();
        res.set(201).send(result);
    });
    app.get('/listImages', async (req, res) => {
        res.set(200).send(JSON.stringify(containers));
    });
    process.on('SIGTERM', async () => {
        await destroyRunners();
        server.close();
    });
    server = app.listen(35123, startWorkers());
}

main();
