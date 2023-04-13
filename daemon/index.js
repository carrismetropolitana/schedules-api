/* * */
/* IMPORTS */
const crontab = require('node-cron');
const GTFSParseDB = require('./databases/gtfsparsedb');
const GTFSAPIDB = require('./databases/gtfsapidb');

const timeCalc = require('./modules/timeCalc');
const filemanager = require('./modules/filemanager');
const setupSqlTables = require('./modules/setupSqlTables');
const saveFilesToTables = require('./modules/saveFilesToTables');
const schedulesBuilder = require('./modules/schedulesBuilder');
const stopsBuilder = require('./modules/stopsBuilder');

const { GTFS_URL } = process.env;

let IS_TASK_RUNNING = false;

// Schedule task (helper: https://crontab.guru/#0_*/3_*_*_*)
crontab.schedule('0 */3 * * *', async () => {
  // CHECK IF TASK IS NOT ALREADY RUNNING
  if (!IS_TASK_RUNNING) await appInitPoint();
});

appInitPoint();
async function appInitPoint() {
  IS_TASK_RUNNING = true;

  try {
    console.log();
    console.log('-----------------------------------------');
    console.log(new Date().toISOString());
    console.log('-----------------------------------------');
    console.log();

    // Store start time for logging purposes
    const startTime = process.hrtime();
    console.log('Starting...');

    // Verify connection to databases
    console.log();
    console.log('STEP 1: Connect to databases...');
    await GTFSParseDB.connect();
    await GTFSAPIDB.connect();

    console.log();
    console.log('STEP 2: Fetching latest GTFS archive...');
    await filemanager.downloadFromUrl(GTFS_URL);

    console.log();
    console.log('STEP 3: Extracting downloaded archive...');
    await filemanager.extractArchive();

    console.log();
    console.log('STEP 4: Create SQL Tables to store the files...');
    await setupSqlTables.createAllTables();

    console.log();
    console.log('STEP 5: Import extracted files into created tables...');
    await saveFilesToTables.saveAllFiles();

    console.log();
    console.log('STEP 6: Cleanup temp files...');
    await filemanager.removeTempDirectory();

    console.log();
    console.log('STEP 7: Build Schedules...');
    await schedulesBuilder.start();

    console.log();
    console.log('STEP 8: Build Stops...');
    await stopsBuilder.start();

    console.log();
    console.log('STEP 9: Disconnect from databases...');
    await GTFSParseDB.disconnect();
    await GTFSAPIDB.disconnect();

    console.log();
    console.log('- - - - - - - - - - - - - - - - - - - - -');
    console.log(`Operation took ${timeCalc.getElapsedTime(startTime)}.`);
    console.log('- - - - - - - - - - - - - - - - - - - - -');
    console.log();

    //
  } catch (err) {
    console.log('An error occurred. Halting execution.', err);
    console.log('Retrying in 10 seconds...');
    // TODO: Send email / notify on error
    setTimeout(() => {
      process.exit(0); // End process
    }, 10000); // after 10 seconds
  }

  IS_TASK_RUNNING = false;
}
