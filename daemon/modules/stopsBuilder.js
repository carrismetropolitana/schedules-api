/* * */
/* IMPORTS */
const GTFSParseDB = require('../databases/gtfsparsedb');
const GTFSAPIDB = require('../databases/gtfsapidb');
const timeCalc = require('./timeCalc');

/**
 * Retrieve all stops with service.
 * @async
 * @returns {Array} Array of stops objects
 */
async function getUniqueRouteShortNamesAtEachStop() {
  const startTime = process.hrtime();
  console.log(`⤷ Querying database...`);
  const [rows, fields] = await GTFSParseDB.connection.execute(
    `
        SELECT 
            stops.stop_id, 
            stops.stop_name, 
            stops.stop_lat, 
            stops.stop_lon, 
            GROUP_CONCAT(DISTINCT routes.route_short_name ORDER BY routes.route_short_name SEPARATOR ',') as routes,
            GROUP_CONCAT(DISTINCT stop_times.departure_time ORDER BY stop_times.departure_time SEPARATOR ',') as departure_times
        FROM 
            stops 
            JOIN stop_times ON stops.stop_id = stop_times.stop_id 
            JOIN trips ON stop_times.trip_id = trips.trip_id 
            JOIN routes ON trips.route_id = routes.route_id 
        GROUP BY 
            stops.stop_id, 
            stops.stop_name, 
            stops.stop_lat, 
            stops.stop_lon 
        ORDER BY 
            stops.stop_id;
    `
  );
  const elapsedTime = timeCalc.getElapsedTime(startTime);
  console.log(`⤷ Done querying the database in ${elapsedTime}.`);
  return rows;
}

//
// Export functions from this module
module.exports = {
  start: async () => {
    //

    // OVERVIEW OF THIS FUNCTION
    // Lorem ipsum

    // Setup a counter that holds all processed stop_ids.
    // This will be used at the end to remove stale data from the database.
    let allProcessedStopIds = [];

    // Get all stops from GTFS table (stops.txt)
    const allStopsWithRoutes = await getUniqueRouteShortNamesAtEachStop();

    for (const currentStop of allStopsWithRoutes) {
      console.log(currentStop);
      return;
      //
      // Record the start time to later calculate duration
      const startTime = process.hrtime();

      // Add this stop to the counter
      allProcessedStopIds.push(currentStop.stop_id);

      // Initiate the formatted route object
      // with the direct values taken from the GTFS table.
      let formattedStop = {
        stop_id: currentStop.stop_id,
        stop_name: currentStop.stop_name,
        stop_lat: currentStop.stop_lat,
        stop_lon: currentStop.stop_lon,
        routes: [],
      };

      for (const foundRouteShortName of currentStop.routes.split(',')) {
        const foundRouteSummaryObject = await GTFSAPIDB.RouteSummary.findOne({ route_short_name: foundRouteShortName });
        if (foundRouteSummaryObject) {
          formattedStop.routes.push(foundRouteSummaryObject);
        }
      }

      await GTFSAPIDB.Stop.findOneAndUpdate({ stop_id: formattedStop.stop_id }, formattedStop, { upsert: true });

      const elapsedTime = timeCalc.getElapsedTime(startTime);
      console.log(`⤷ [${allProcessedStopIds.length}/${allStopsWithRoutes.length}] Saved stop ${formattedStop.stop_id} to API Database in ${elapsedTime}.`);

      //
    }

    // Delete all stops not present in the last update
    const deletedStaleStops = await GTFSAPIDB.Stop.deleteMany({ stop_id: { $nin: allProcessedStopIds } });
    console.log(`⤷ Deleted ${deletedStaleStops.deletedCount} stale stops.`);

    //
  },
};
