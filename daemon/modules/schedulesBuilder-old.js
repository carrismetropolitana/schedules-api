/* * */
/* IMPORTS */
const GTFSParseDB = require('../databases/gtfsparsedb');
const GTFSAPIDB = require('../databases/gtfsapidb');
const timeCalc = require('./timeCalc');

/**
 * Fetch municipalities from www
 * @async
 * @returns {Array} Array of municipalities
 */
async function getMunicipalities() {
  const response = await fetch('https://www.carrismetropolitana.pt/?api=municipalities');
  if (response.ok) return response.json();
  else throw Error('Could not fetch municipalities.', response);
}

//
//
//

/**
 * Retrieve all routes from 'routes' table
 * @async
 * @returns {Array} Array of route objects
 */
async function getRoutes() {
  const [rows, fields] = await GTFSParseDB.connection.execute(`
    SELECT
        route_id,
        route_short_name,
        route_long_name,
        route_color,
        route_text_color,
        route_type
    FROM
        routes
  `);
  return rows;
}

//
//
//

/**
 * Retrieve all trips
 * @async
 * @returns {Array} Array of trip objects
 */
async function getAllTrips() {
  const [rows, fields] = await GTFSParseDB.connection.execute(
    `
        SELECT
            trip_id,
            direction_id,
            trip_headsign,
            service_id,
            shape_id
        FROM
            trips
    `
  );
  return rows;
}

/**
 * Retrieve trips matching the provided route_id
 * @async
 * @param {String} route_id The route_id related to the trip
 * @returns {Array} Array of trip objects
 */
async function getTrips(route_id) {
  const [rows, fields] = await GTFSParseDB.connection.execute(
    `
        SELECT
            trip_id,
            direction_id,
            trip_headsign,
            service_id,
            shape_id
        FROM
            trips
        WHERE
            route_id = ?
    `,
    [route_id]
  );
  return rows;
}

//
//
//

/**
 * Retrieve shape matching the provided shape_id
 * @async
 * @param {String} shape_id The shape_id to retrieve
 * @returns {Array} Array of shape points
 */
async function getShape(shape_id) {
  const [rows, fields] = await GTFSParseDB.connection.execute(
    `
        SELECT
            shape_pt_lat,
            shape_pt_lon,
            shape_pt_sequence,
            shape_dist_traveled
        FROM
            shapes
        WHERE
            shape_id = ?
    `,
    [shape_id]
  );
  return rows;
}

//
//
//

/**
 * Retrieve the dates matching the provided service_id
 * @async
 * @param {String} service_id The service_id to retrieve
 * @returns {Array} Array of date strings
 */
async function getDates(service_id) {
  const [rows, fields] = await GTFSParseDB.connection.execute(
    `
        SELECT
            date
        FROM
            calendar_dates
        WHERE
            service_id = ?
        AND
            exception_type = 1
    `,
    [service_id]
  );
  return rows;
}

//
//
//

/**
 * Retrieve stops for the given trip_id
 * @async
 * @param {String} trip_id The trip_id to retrieve from stop_times
 * @returns {Array} Array of stops objects
 */
async function getStopTimes(trip_id) {
  const [rows, fields] = await GTFSParseDB.connection.execute(
    `
        SELECT
            st.stop_id,
            st.stop_sequence,
            st.arrival_time,
            st.departure_time,
            s.stop_name,
            s.stop_lat,
            s.stop_lon
        FROM
            stop_times st
            INNER JOIN stops s ON st.stop_id = s.stop_id
        WHERE
            st.trip_id = ?
        ORDER BY
            st.stop_sequence
    `,
    [trip_id]
  );
  return rows;
}

//
//
//

//
// Export functions from this module
module.exports = {
  start: async () => {
    //

    /* * */

    // This function builds a JSON 'route' object by stiching information
    // available in the several GTFS standard files. These files were previously
    // imported to MySQL tables with corresponding names.
    // This 'route' object is composed of general route information, served municipalities
    // and directions. Each direction has an ID, a destination (headsign) a shape representation
    // and a collection of trips. Each trip in the same direction has an ID, a collection
    // of dates (calendar days) where the trip will happen, and a schedule. The schedule is
    // asequence of stops, each with its own info and arrival and departure times.

    // The building of these route objects happen sequentially, with four nested loops:
    //   1. The main loop, for all the routes in the database;
    //      2. All the directions for the same route (no more than 2);
    //         3. All the trips for the same direction;
    //            4. All the stops for the same trip;

    // At the end of each iteration of the first loop, each JSON route object is saved
    // to the MongoDB API database. If the route already existed, then it is updated.
    // Several routes can have the same route_short_name. This means that for the same 'line'
    // there is at least one 'base' and optionally serveral 'variants'. The base is always
    // the route_id with the lowest suffix (ex: 1234_0, or 1234_1 if no _0 exists) for all routes
    // with the same 'route_short_name'. After all individual routes are saved in the database,
    // further processing happens to find out the base for each line. These routes are saved
    // in the RouteSummary collection in MongoDB.

    /* * */

    // ROUTE > PATTERN > TRIP

    // Setup a counter that holds all processed route_ids.
    // This is used at the end to remove stale data from the database.
    let allProcessedRouteIds = [];

    // Fetch municipalities from www
    const allMunicipalities = await getMunicipalities();
    console.log(`⤷ Done fetching municipalities.`);

    // Get all routes from GTFS table (routes.txt)
    const allRoutes = await getRoutes();

    // LOOP 1 — Routes
    for (const currentRoute of allRoutes) {
      //
      // Record the start time to later calculate duration
      const startTime = process.hrtime();

      // Add this route to the counter
      allProcessedRouteIds.push(currentRoute.route_id);

      // Initiate the formatted route object
      let formattedRoute = {
        route_id: currentRoute.route_id,
        route_short_name: currentRoute.route_short_name,
        route_long_name: currentRoute.route_long_name,
        route_color: `#${currentRoute.route_color || 'FA3250'}`,
        route_text_color: `#${currentRoute.route_text_color || 'FFFFFF'}`,
        municipalities: [],
        directions: [],
      };

      // Get all trips associated with this route
      const allTrips_raw = await getTrips(currentRoute.route_id);

      // Simplify trips array by removing non-common attributes
      const allTrips_simplified = allTrips_raw.map((trip) => {
        return { direction_id: trip.direction_id, headsign: trip.trip_headsign, shape_id: trip.shape_id };
      });

      // Deduplicate simplified trips array to keep only common attributes.
      // This essentially results in an array of 'directions'. Save it to the route object.
      const allDirections = allTrips_simplified.filter((value, index, array) => {
        return index === array.findIndex((valueInner) => JSON.stringify(valueInner) === JSON.stringify(value));
      });

      // LOOP 2 — Directions
      for (const currentDirection of allDirections) {
        //
        // Initiate the formatted direction object
        let formattedDirection = {
          direction_id: currentDirection.direction_id,
          headsign: currentDirection.headsign,
          shape: [],
          trips: [],
        };

        // Get shape for this direction and sort it by 'shape_pt_sequence'
        // The use of collator here is to ensure 'natural sorting' on numeric strings: https://stackoverflow.com/questions/2802341/natural-sort-of-alphanumerical-strings-in-javascript
        const shape_raw = await getShape(currentDirection.shape_id);
        const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
        formattedDirection.shape = shape_raw.sort((a, b) => collator.compare(a.shape_pt_sequence, b.shape_pt_sequence));

        // LOOP 3 - Trips
        for (const currentTrip of allTrips_raw) {
          //
          // Skip all trips that do not belong to the current direction
          if (currentTrip.direction_id !== currentDirection.direction_id) continue;

          // Initiate the formatted trip object
          let formattedTrip = {
            trip_id: currentTrip.trip_id,
            dates: [],
            schedule: [],
          };

          // Get dates in the YYYYMMDD format (GTFS Standard format)
          const allDates_raw = await getDates(currentTrip.service_id);
          formattedTrip.dates = allDates_raw.map((item) => item.date);

          // Get stop times for this trip
          const allStopTimes_raw = await getStopTimes(currentTrip.trip_id);

          // LOOP 4 - Stop Times
          for (const currentStopTime of allStopTimes_raw) {
            //
            // Format arrival_time
            const arrival_time_array = currentStopTime.arrival_time.split(':');
            let arrival_time_hours = arrival_time_array[0].padStart(2, '0');
            if (arrival_time_hours && Number(arrival_time_hours) > 23) {
              const arrival_time_hours_adjusted = Number(arrival_time_hours) - 24;
              arrival_time_hours = String(arrival_time_hours_adjusted).padStart(2, '0');
            }
            const arrival_time_minutes = arrival_time_array[1].padStart(2, '0');
            const arrival_time_seconds = arrival_time_array[2].padStart(2, '0');

            // Format departure_time
            const departure_time_array = currentStopTime.departure_time.split(':');
            let departure_time_hours = departure_time_array[0].padStart(2, '0');
            if (departure_time_hours && Number(departure_time_hours) > 23) {
              const departure_time_hours_adjusted = Number(departure_time_hours) - 24;
              departure_time_hours = String(departure_time_hours_adjusted).padStart(2, '0');
            }
            const departure_time_minutes = departure_time_array[1].padStart(2, '0');
            const departure_time_seconds = departure_time_array[2].padStart(2, '0');

            // Find out which municipalities this route serves
            // using the first two digits of stop_id
            const municipalityId = currentStopTime.stop_id?.substr(0, 2);
            // Check if this municipaliy is already in the route
            const alreadyHasMunicipality = formattedRoute.municipalities?.findIndex((item) => {
              return municipalityId === item.id;
            });
            // Add the municipality if it is still not added
            if (alreadyHasMunicipality < 0) {
              const stopMunicipality = allMunicipalities.filter((item) => {
                return municipalityId === item.id;
              });
              if (stopMunicipality.length) {
                formattedRoute.municipalities.push(stopMunicipality[0]);
              }
            }
            // Save formatted stop time
            formattedTrip.schedule.push({
              stop_sequence: currentStopTime.stop_sequence,
              stop_id: currentStopTime.stop_id,
              stop_name: currentStopTime.stop_name,
              stop_lon: currentStopTime.stop_lon,
              stop_lat: currentStopTime.stop_lat,
              arrival_time: `${arrival_time_hours}:${arrival_time_minutes}:${arrival_time_seconds}`,
              arrival_time_operation: currentStopTime.arrival_time,
              departure_time: `${departure_time_hours}:${departure_time_minutes}:${departure_time_seconds}`,
              departure_time_operation: currentStopTime.departure_time,
              shape_dist_traveled: currentStopTime.shape_dist_traveled,
            });
          }

          // Save trip object to trips array
          formattedDirection.trips.push(formattedTrip);
        }

        // Sort trips by departure_time ASC
        formattedDirection.trips.sort((a, b) => (a.schedule[0]?.departure_time_operation > b.schedule[0]?.departure_time_operation ? 1 : -1));

        // Save this direction in formattedRoutes
        formattedRoute.directions.push(formattedDirection);
      }

      // Save route to MongoDB
      await GTFSAPIDB.Route.findOneAndUpdate({ route_id: formattedRoute.route_id }, formattedRoute, { upsert: true });

      const elapsedTime = timeCalc.getElapsedTime(startTime);
      console.log(`⤷ [${allProcessedRouteIds.length}/${allRoutes.length}] Saved route ${formattedRoute.route_id} to API Database in ${elapsedTime}.`);

      //
    }

    // Delete all documents with route_ids not present in the new GTFS version
    const deletedStaleRoutes = await GTFSAPIDB.Route.deleteMany({ route_id: { $nin: allProcessedRouteIds } });
    console.log(`⤷ Deleted ${deletedStaleRoutes.deletedCount} stale routes.`);

    // Retrieve all distinct route_short_names and iterate on each one.
    const allRouteBasesInDatabase = await GTFSAPIDB.Route.aggregate([
      {
        $group: {
          _id: '$route_short_name',
          route_id: { $min: '$route_id' },
          route_long_name: { $first: '$route_long_name' },
          route_color: { $first: '$route_color' },
          route_text_color: { $first: '$route_text_color' },
          municipalities: { $first: '$municipalities' },
        },
      },
      {
        $project: {
          _id: 0,
          route_id: 1,
          route_short_name: '$_id',
          route_long_name: 1,
          route_color: 1,
          route_text_color: 1,
          municipalities: 1,
        },
      },
    ]);

    // Update the database with the new group of route bases
    for (const routeBase of allRouteBasesInDatabase) {
      await GTFSAPIDB.RouteSummary.findOneAndUpdate({ route_id: routeBase.route_id }, routeBase, { upsert: true });
      console.log(`⤷ Saved route base ${routeBase.route_id} to API Database.`);
    }

    // Delete all route bases not present in the last update
    const allProcessedBaseRouteIds = allRouteBasesInDatabase.map((item) => item.route_id);
    const deletedStaleRouteBases = await GTFSAPIDB.RouteSummary.deleteMany({ route_id: { $nin: allProcessedBaseRouteIds } });
    console.log(`⤷ Deleted ${deletedStaleRouteBases.deletedCount} stale route bases.`);

    //
  },
};
