const fs = require('fs');
const inspector = require('inspector');
const { fileURLToPath } = require('url');

const EC = require('eight-colors');

const CoverageReport = require('../');

// v8 and lcov
const coverageOptions = {
    // logging: 'debug',
    // watermarks: [60, 90],
    reports: 'v8',

    name: 'My V8 Node Coverage Report',
    assetsPath: '../assets',
    lcov: true,

    outputDir: './docs/v8-node'
};


const generate = async () => {
    console.log('generate v8-node coverage reports ...');

    const coverageResults = await new CoverageReport(coverageOptions).generate();
    console.log('reportPath', EC.magenta(coverageResults.reportPath));
    console.log('v8-node coverage generated', Object.keys(coverageResults.summary).map((k) => [k, coverageResults.summary[k].pct]));

};

const startV8Coverage = async () => {
    // start node.js coverage
    const session = new inspector.Session();
    session.connect();

    await session.post('Profiler.enable');
    await session.post('Profiler.startPreciseCoverage', {
        callCount: true,
        detailed: true
    });

    return session;
};

const collectV8Coverage = (session) => {
    return new Promise((resolve) => {
        session.post('Profiler.takePreciseCoverage', async (error, coverage) => {
            if (error) {
                console.log(error);
                resolve();
                return;
            }

            let coverageList = coverage.result;

            // filter node internal files
            coverageList = coverageList.filter((entry) => entry.url && !entry.url.startsWith('node:'));

            // filter node modules
            coverageList = coverageList.filter((entry) => entry.url.indexOf('node_modules') === -1);

            // node.js coverage haven't source attached
            coverageList.forEach((item) => {
                const filePath = fileURLToPath(item.url);
                if (fs.existsSync(filePath)) {
                    item.source = fs.readFileSync(filePath).toString('utf8');
                } else {
                    console.log('not found file', filePath);
                }
            });

            // console.log(coverageList);

            console.log('add node.js coverage');
            await new CoverageReport(coverageOptions).add(coverageList);

            resolve();
        });
    });


};


module.exports = async () => {
    // clean cache first
    await new CoverageReport(coverageOptions).cleanCache();

    // =====================================================
    const session = await startV8Coverage();


    EC.logGreen('first function');
    await collectV8Coverage(session);


    EC.logGreen('second function');
    await collectV8Coverage(session);

    // =====================================================

    await generate();
};