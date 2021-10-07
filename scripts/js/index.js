const vpc = require('./init-vpc');

async function main() {
    await vpc.Cleanup();
    await vpc.Initialize();
}

main();
