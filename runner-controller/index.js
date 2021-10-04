const express = require('express');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { promisify } = require('util');
const axios = require('axios');

const {
    REPO_FULLNAME, REPO_ROOT_TOKEN, WORKERS_COUNT,
    WORKERS_LABEL, DOCKER_IMAGE, S_PORT, S_ENDPOINT } = require('./env');

const token = {
    value: '',
    expires: new Date()
};
let destroy = false;
const containers = [];

async function getTokenImpl(endpointPart, token) {
     const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    if (now > token.expires) {
        const response = await axios({
            url: `https://api.github.com/repos/${REPO_FULLNAME}/actions/runners/${endpointPart}`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${REPO_ROOT_TOKEN}`
            }
        });
        if (response.status >= 200 && response.status < 300) {
            token.value = response.data.token;
            token.expires = response.data.expires_at;
        }
    }
    return token.value;
}

async function getRegistrationToken(){
    await getTokenImpl('registration-token', token);
    return token.value;
};

async function getRemoveToken() {
    const result = { expires: new Date() };
    await getTokenImpl('remove-token', result);
    return result.value;
}

async function startWorker(){
    while (!destroy) {
        const name = uuidv4().substr(0,8);
        containers.push(name);
        const data = {
            url: `https://github.com/${REPO_FULLNAME}`,
            token: await getRegistrationToken(),
            type: WORKERS_LABEL,
            name: `${WORKERS_LABEL}-${name}`,
            count: WORKERS_COUNT,
            port: S_PORT,
        }
        const base64String = Buffer.from(JSON.stringify(data)).toString('base64');
        await promisify(exec)(`docker run --name ${name} ${DOCKER_IMAGE} ${base64String}`)
            .catch(x => {
                if (x.code === 137 || x.code === 143)
                    return;
                throw (x);
            });
    }
};

async function startWorkers() {
    await Promise.all([...Array(+WORKERS_COUNT).keys()].map(startWorker));
}

const stopAndDestroy = async (containerName) => {
    try {
        await promisify(exec)(`docker stop -t ${15*60} ${containerName}`);
        await promisify(exec)(`docker rm ${containerName}`);
    } catch {
        console.log(`Runner ${containerName} does not exist`);
    }
}

async function destroyRunners() {
    destroy = true;
    await Promise.all(containers.map(stopAndDestroy));
}

function main() {
    let server;

    const app = new express();
    app.post(`/${S_ENDPOINT}/`, async (req, res) => {
        await destroyRunners();
        res.set(200).send();
        server.close();
    });
    app.get('/removeToken', async (req, res)=> {
        const result = await getRemoveToken();
        res.set(201).send(result);
    })
    process.on('SIGTERM', async () => {
        await destroyRunners();
        server.close();
    })
    server = app.listen(S_PORT, startWorkers());
}

main();
