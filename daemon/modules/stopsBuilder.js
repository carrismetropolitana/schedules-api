/* * */
/* IMPORTS */
const GTFSParseDB = require('../databases/gtfsparsedb');
const GTFSAPIDB = require('../databases/gtfsapidb');
const timeCalc = require('./timeCalc');

/**
 * Retrieve all stops from 'stops' table
 * @async
 * @returns {Array} Array of stop objects
 */
async function getAllStops() {
  const [rows, fields] = await GTFSParseDB.connection.execute(`
      SELECT
          stop_id,
          stop_name,
          stop_lat,
          stop_lon
      FROM
          stops
    `);
  return rows;
}

//
//
//

/**
 * Retrieve all stops with service.
 * @async
 * @returns {Array} Array of stops objects
 */
async function getStopInfoFromDatabase(stop_id) {
  const startTime = process.hrtime();
  console.log(`⤷ Querying database...`);
  const [rows, fields] = await GTFSParseDB.connection.execute(
    `
        SELECT 
            stops.stop_id, 
            routes.route_id,
            routes.route_short_name,
            routes.route_color,
            routes.route_text_color,
            trips.trip_id,
            trips.direction_id,
            trips.trip_headsign,
            stop_times.departure_time,
            stop_times.stop_sequence,
            GROUP_CONCAT(calendar_dates.date ORDER BY calendar_dates.date ASC SEPARATOR ',') AS dates
        FROM 
            stops 
            JOIN stop_times ON stops.stop_id = stop_times.stop_id 
            JOIN trips ON stop_times.trip_id = trips.trip_id 
            JOIN calendar_dates ON trips.service_id = calendar_dates.service_id 
            JOIN routes ON trips.route_id = routes.route_id 
        WHERE 
            stops.stop_id = ?
        GROUP BY 
            stops.stop_id, 
            routes.route_id,
            routes.route_short_name,
            routes.route_color,
            routes.route_text_color,
            trips.trip_id,
            trips.direction_id,
            trips.trip_headsign,
            stop_times.departure_time,
            stop_times.stop_sequence 
        ORDER BY 
            stops.stop_id, 
            stop_times.departure_time;
    `,
    [stop_id]
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
    const allStops = await getAllStops();

    // Iterate on each stop
    for (const currentStop of allStops) {
      //
      // Record the start time to later calculate duration
      const startTime = process.hrtime();

      // Add this stop to the counter
      allProcessedStopIds.push(currentStop.stop_id);

      // Initiate the formatted stop object
      let formattedStop = {
        stop_id: currentStop.stop_id,
        stop_name: currentStop.stop_name,
        stop_lat: currentStop.stop_lat,
        stop_lon: currentStop.stop_lon,
        routes: [],
        schedule: [],
      };

      // Get stop schedule from database
      const stopSchedule_raw = await getStopInfoFromDatabase(currentStop.stop_id);

      // Process each row of data retrieved from the database
      for (const currentRow of stopSchedule_raw) {
        // Format departure_time
        const departure_time_array = currentRow.departure_time.split(':');
        let departure_time_hours = departure_time_array[0].padStart(2, '0');
        if (departure_time_hours && Number(departure_time_hours) > 23) {
          const departure_time_hours_adjusted = Number(departure_time_hours) - 24;
          departure_time_hours = String(departure_time_hours_adjusted).padStart(2, '0');
        }
        const departure_time_minutes = departure_time_array[1].padStart(2, '0');
        const departure_time_seconds = departure_time_array[2].padStart(2, '0');

        // For the current row add the found schedule to the correct stop_id
        formattedStop.schedule.push({
          route_id: currentRow.route_id,
          route_short_name: currentRow.route_short_name,
          route_color: `#${currentRow.route_color}`,
          route_text_color: `#${currentRow.route_text_color}`,
          trip_id: currentRow.trip_id,
          direction_id: currentRow.direction_id,
          trip_headsign: currentRow.trip_headsign,
          dates: currentRow.dates.split(','),
          departure_time: `${departure_time_hours}:${departure_time_minutes}:${departure_time_seconds}`,
          departure_time_operation: currentRow.departure_time,
        });
        // If the current route_short_name is not yet in the routes array of the route object,
        // retrieve the RouteSummary object from the database and save it to the routes array of this stop.
        if (!formattedStop.routes.some((object) => object.route_short_name === currentRow.route_short_name)) {
          const foundRouteSummaryObject = await GTFSAPIDB.RouteSummary.findOne({ route_short_name: currentRow.route_short_name });
          if (foundRouteSummaryObject) {
            formattedStop.routes.push(foundRouteSummaryObject);
          }
        }
      }

      console.log('formattedStop.schedule[0]', formattedStop.schedule[0]);

      // Save the formatted stop to the database
      await GTFSAPIDB.Stop.findOneAndUpdate({ stop_id: currentStop.stop_id }, currentStop, { upsert: true });

      // Calculate elapsed time and log progress
      const elapsedTime = timeCalc.getElapsedTime(startTime);
      console.log(`⤷ [${allProcessedStopIds.length}/${allStops.length}] Saved stop ${currentStop.stop_id} to API Database in ${elapsedTime}.`);

      //
    }

    // Delete all stops not present in the last update
    const deletedStaleStops = await GTFSAPIDB.Stop.deleteMany({ stop_id: { $nin: allProcessedStopIds } });
    console.log(`⤷ Deleted ${deletedStaleStops.deletedCount} stale stops.`);

    //
  },
};
