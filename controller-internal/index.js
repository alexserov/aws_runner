const Express = require('express');
const EC2Pool = require('./ec2pool');

const internalPort = 32653;

const app = new Express();
const pool = new EC2Pool();

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

app.listen(internalPort);
