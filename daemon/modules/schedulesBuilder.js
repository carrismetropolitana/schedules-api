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
 * Retrieve all shapes from 'shapes' table
 * @async
 * @returns {Array} Array of shape point objects
 */
async function getAllShapes() {
  const [rows, fields] = await GTFSParseDB.connection.execute(`
      SELECT
          shape_id,
          shape_pt_lat,
          shape_pt_lon,
          shape_pt_sequence,
          shape_dist_traveled
      FROM
          shapes
    `);
  return rows;
}

//
//
//

/**
 * Retrieve all routes from 'routes' table
 * @async
 * @returns {Array} Array of route objects
 */
async function getAllRoutes() {
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
 * Retrieve trips matching the provided route_id
 * @async
 * @param {String} route_id The route_id related to the trip
 * @returns {Array} Array of trip objects
 */
async function getTrips(route_id) {
  const [rows, fields] = await GTFSParseDB.connection.execute(
    `
        SELECT
            route_id,
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

// accumulator[existingShape].geojson.geometry.push([parseFloat(currentPoint.shape_pt_lon), parseFloat(currentPoint.shape_pt_lat)]);

async function formatAndSaveAllShapes() {
  //
  console.log(`⤷ Preparing to format shapes...`);

  // Record the start time to later calculate duration
  const startTime_Shapes = process.hrtime();

  // Get all shapes from GTFS table (shapes.txt)
  const allShapes_raw = await getAllShapes();

  console.log(`⤷ Got ${allShapes_raw.length} rows from SQL.`);

  // Combine shapes with the same shape_id into a 'shape' object
  const allShapes_formatted = allShapes_raw.reduce((accumulator, currentPoint) => {
    // Check if the shape for this point is already present in the accumulator
    const existingShape = accumulator.findIndex((item) => item.shape_id === currentPoint.shape_id);
    // If there is not a shape yet, add this point as a new shape with all its properties
    if (existingShape === -1)
      accumulator.push({
        shape_id: currentPoint.shape_id,
        points: [{ shape_pt_lat: currentPoint.shape_pt_lat, shape_pt_lon: currentPoint.shape_pt_lon, shape_pt_sequence: currentPoint.shape_pt_sequence, shape_dist_traveled: currentPoint.shape_dist_traveled }],
        geojson: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
      });
    // else, if there is a shape already, then add this point to the array of points.
    else accumulator[existingShape].points.push({ shape_pt_lat: currentPoint.shape_pt_lat, shape_pt_lon: currentPoint.shape_pt_lon, shape_pt_sequence: currentPoint.shape_pt_sequence, shape_dist_traveled: currentPoint.shape_dist_traveled });
    // Finally return the updated accumulator array
    return accumulator;
  }, []);

  console.log(`⤷ Shape points reduced into ${allShapes_formatted.length} shapes.`);

  // Sort each shape points array by 'shape_pt_sequence'
  // The use of collator here is to ensure 'natural sorting' on numeric strings: https://stackoverflow.com/questions/2802341/natural-sort-of-alphanumerical-strings-in-javascript
  allShapes_formatted.forEach((currentShape) => {
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    currentShape.points = currentShape.points.sort((a, b) => collator.compare(a.shape_pt_sequence, b.shape_pt_sequence));
  });

  console.log(`⤷ Shapes ordered by "shape_pt_sequence".`);

  // Create the geojson structure for each shape
  allShapes_formatted.forEach((currentShape) => {
    currentShape.geojson.geometry.coordinates = currentShape.points.map((currentPoint) => {
      return [parseFloat(currentPoint.shape_pt_lon), parseFloat(currentPoint.shape_pt_lat)];
    });
  });

  console.log(`⤷ Shapes geojson.`);

  // Finally, update all shapes
  for (const [currentShapeIndex, currentShape] of allShapes_formatted.entries()) {
    await GTFSAPIDB.Shape.findOneAndUpdate({ shape_id: currentShape.shape_id }, currentShape, { upsert: true });
    console.log(`⤷ [${currentShapeIndex}/${allShapes_formatted.length}] Saved shape_id ${currentShape.shape_id} to API database.`);
  }

  // Log progress
  console.log(`⤷ Saved ${allShapes_formatted.length} shapes to API Database in ${timeCalc.getElapsedTime(startTime_Shapes)}.`);

  // Delete all documents with shape_ids not present in the new GTFS version
  const allProcessedShapeIds = allShapes_formatted.map((item) => item.shape_id);
  const deletedStaleShapes = await GTFSAPIDB.Shape.deleteMany({ shape_id: { $nin: allProcessedShapeIds } });
  console.log(`⤷ Deleted ${deletedStaleShapes.deletedCount} stale shapes.`);

  //
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

    /* */
    /* MUNICIPALITIES */

    // Fetch municipalities from www
    const allMunicipalities = await getMunicipalities();
    console.log(`⤷ Done fetching municipalities.`);

    //
    //
    //

    /* */
    /* SHAPES */

    // Get all shapes from GTFS table (shapes.txt)
    // and save them to MongoDB.
    // await formatAndSaveAllShapes();

    //
    //
    //

    /* */
    /* ROUTES INTO LINES */

    // Record the start time to later calculate duration
    const startTime_RoutesIntoLines = process.hrtime();

    // Get all routes from GTFS table (routes.txt)
    const allRoutes_raw = await getAllRoutes();

    // Combine routes with the same route_short_name into a 'line' object
    const allLines_raw = allRoutes_raw.reduce((accumulator, currentRoute) => {
      // Get, from the accumulator, a line object matching the route_short_name of the route_id being iterated
      const existingLine = accumulator.find((item) => item.route_short_name === currentRoute.route_short_name);
      // If there is a line, then add this route_id to the array of route_ids.
      if (existingLine) existingLine.route_ids.push(currentRoute.route_id);
      // else, add this route as a new line with all its properties.
      else accumulator.push({ route_ids: [currentRoute.route_id], ...currentRoute });
      // Finally return the updated accumulator array
      return accumulator;
    }, []);

    console.log(`⤷ Reduced ${allRoutes_raw.length} routes into ${allLines_raw.length} lines in ${timeCalc.getElapsedTime(startTime_RoutesIntoLines)}.`);

    //

    // 1. LINES
    // Iterate on each line
    for (const [currentLineIndex, currentLine] of allLines_raw.entries()) {
      //
      // Record the start time to later calculate duration
      const startTime_line = process.hrtime();

      // Initiate the formatted line object
      let formattedLine = {
        route_ids: currentLine.route_ids,
        route_short_name: currentLine.route_short_name,
        route_long_name: currentLine.route_long_name,
        route_color: `#${currentLine.route_color || 'FA3250'}`,
        route_text_color: `#${currentLine.route_text_color || 'FFFFFF'}`,
        municipalities: [],
        patterns: [],
      };

      // 2. ROUTES
      // Iterate on each route
      for (const currentRouteId of currentLine.route_ids) {
        //
        // Record the start time to later calculate duration
        const startTime_route = process.hrtime();

        // Get all trips associated with this route
        const allTripsForThisRoute_raw = await getTrips(currentRouteId);

        // Simplify the trips array to only include the following attributes.
        // These are the distinguishing factors for each pattern, i.e. the path and direction of a vehicle.
        const allTripsForThisRoute_simplified = allTripsForThisRoute_raw.map((trip) => {
          return {
            route_id: trip.route_id,
            direction_id: trip.direction_id,
            headsign: trip.trip_headsign,
          };
        });

        // For the above properties, remove all duplicate entries.
        // This essentially results in the array of 'patterns'.
        const allPatternsForThisRoute = allTripsForThisRoute_simplified.filter((value, index, array) => {
          return index === array.findIndex((valueInner) => JSON.stringify(valueInner) === JSON.stringify(value));
        });

        // 3. PATTERNS
        // Iterate on each pattern
        for (const currentPattern of allPatternsForThisRoute) {
          //
          // Initiate the formatted pattern object
          let formattedPattern = {
            pattern_id: `${currentPattern.route_id}_${currentPattern.direction_id}`,
            direction_id: currentPattern.direction_id,
            headsign: currentPattern.headsign,
            trips: [],
          };

          // 4. TRIPS
          // Iterate on each trip
          for (const currentTrip of allTripsForThisRoute_raw) {
            //
            // Skip all trips that do not belong to the current direction
            if (currentTrip.direction_id !== currentPattern.direction_id) continue;

            // Initiate the formatted trip object
            let formattedTrip = {
              trip_id: currentTrip.trip_id,
              shape_id: currentTrip.shape_id,
              calendar_desc: currentTrip.calendar_desc,
              dates: [],
              schedule: [],
            };

            // Get dates in the YYYYMMDD format (GTFS Standard format)
            const allDates_raw = await getDates(currentTrip.service_id);
            formattedTrip.dates = allDates_raw.map((item) => item.date);

            // Get stop times for this trip
            const allStopTimes_raw = await getStopTimes(currentTrip.trip_id);

            // 5. STOP TIMES
            // Iterate on each stop for this trip
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
              const alreadyHasMunicipality = formattedLine.municipalities?.findIndex((item) => {
                return municipalityId === item.id;
              });
              // Add the municipality if it is still not added
              if (alreadyHasMunicipality < 0) {
                const stopMunicipality = allMunicipalities.filter((item) => {
                  return municipalityId === item.id;
                });
                if (stopMunicipality.length) {
                  formattedLine.municipalities.push(stopMunicipality[0]);
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

              //
            }

            // Save trip object to trips array
            formattedPattern.trips.push(formattedTrip);

            //
          }

          // Sort trips by departure_time ASC
          formattedPattern.trips.sort((a, b) => (a.schedule[0]?.departure_time_operation > b.schedule[0]?.departure_time_operation ? 1 : -1));

          // Save this pattern in formattedLine
          formattedLine.patterns.push(formattedPattern);

          //
        }

        //
      }

      // Save route to MongoDB
      await GTFSAPIDB.Line.findOneAndUpdate({ route_short_name: formattedLine.route_short_name }, formattedLine, { upsert: true });
      console.log(`⤷ [${currentLineIndex}/${allLines_raw.length}] Saved line ${formattedLine.route_short_name} to API Database in ${timeCalc.getElapsedTime(startTime_line)}.`);

      //
    }

    // Delete all documents with route_short_names not present in the new GTFS version
    const allProcessedLineRouteShortNames = allLines_raw.map((item) => item.route_short_name);
    const deletedStaleLines = await GTFSAPIDB.Shape.deleteMany({ shape_id: { $nin: allProcessedLineRouteShortNames } });
    console.log(`⤷ Deleted ${deletedStaleLines.deletedCount} stale lines.`);

    //
  },

  //
};
