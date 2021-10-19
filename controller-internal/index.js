const Express = require('express');
const EC2Pool = require('./ec2pool');
const Secrets = require('./secrets');
const config = require('../config');

const internalPort = config.constants.vpc.ports.controllerPrivate;

const app = new Express();
const pool = new EC2Pool();
const secrets = new Secrets(config.repository, config.constants.iam.secretId);

app.post('/job_queued', async (req, res) => {
    pool.increaseLoad();
    res.status(200);
    res.send();
});
app.post('/job_in_progress', async (req, res) => {
    res.status(200);
    res.send();
});
app.post('/job_completed', async (req, res) => {
    pool.decreaseLoad();
    res.status(200);
    res.send();
});
app.get('/request_registration_token', async (req, res) => {
    const token = await secrets.getRegistrationToken();
    res.status(201);
    res.send(token);
});
app.get('/request_remove_token', async (req, res) => {
    const token = await secrets.getRemoveToken();
    res.status(201);
    res.send(token);
});

app.listen(internalPort);
