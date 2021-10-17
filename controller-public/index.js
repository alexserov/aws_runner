const Express = require('express');
const axios = require('axios');
const config = require('../config');

const publicPort = config.constants.vpc.ports.controllerPublic;
const internalPort = config.constants.vpc.ports.controllerPrivate;
const app = new Express();

app.post('/', async (req, res) => {
    const header = req.headers['x-github-event'];
    let status = 403;
    switch (header) {
    case 'workflow_job':
        status = await handleWorkflowJob(req);
        break;
    default:
        break;
    }
    res.status(status);
    res.send();
});

async function handleWorkflowJob(request) {
    const {
        id,
        status, // "queued", "in_progress", "completed"
        labels,
    } = request.body;

    const response = await axios.post(
        `127.0.0.1:${internalPort}/job_${status}`,
        JSON.stringify({ id, labels }),
        {
            headers: {
                'Content-Type': 'application/json',
            },
        },
    );
    return response.status;
}

app.listen(publicPort);
