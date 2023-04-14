/* * */
/* IMPORTS */
const GTFSParseDB = require('../databases/gtfsparsedb');

module.exports = {
  createAllTables: async () => {
    //

    let dropExistingTables = 'DROP TABLE IF EXISTS temp_calendar_dates, temp_routes, temp_shapes, temp_stop_times, temp_stops, temp_trips;';
    await GTFSParseDB.connection.execute(dropExistingTables);
    console.log('⤷ Dropped existing temp_ SQL tables.');

    // Create tables

    await GTFSParseDB.connection.execute(`CREATE TABLE temp_calendar_dates (
        service_id VARCHAR(255),
        date VARCHAR(8),
        period SMALLINT,
        day_type SMALLINT,
        exception_type SMALLINT
    );`);
    await GTFSParseDB.connection.execute('ALTER TABLE temp_calendar_dates ADD KEY `service_id` (`service_id`);');
    console.log('⤷ Created SQL table "temp_calendar_dates".');

    await GTFSParseDB.connection.execute(`CREATE TABLE temp_routes (
        route_id VARCHAR(10),
        route_short_name VARCHAR(10),
        route_long_name VARCHAR(255),
        route_type VARCHAR(255),
        route_color VARCHAR(6),
        route_text_color VARCHAR(6)
    );`);
    await GTFSParseDB.connection.execute('ALTER TABLE temp_routes ADD KEY `route_id` (`route_id`);');
    console.log('⤷ Created SQL table "temp_routes".');

    await GTFSParseDB.connection.execute(`CREATE TABLE temp_shapes (
        shape_id VARCHAR(255),
        shape_pt_lat FLOAT(6),
        shape_pt_lon FLOAT(6),
        shape_pt_sequence SMALLINT,
        shape_dist_traveled FLOAT(6)
    );`);
    await GTFSParseDB.connection.execute('ALTER TABLE temp_shapes ADD KEY `shape_id` (`shape_id`);');
    console.log('⤷ Created SQL table "temp_shapes".');

    await GTFSParseDB.connection.execute(`CREATE TABLE temp_stop_times (
        trip_id VARCHAR(255),
        arrival_time TIME,
        departure_time TIME,
        stop_id VARCHAR(6),
        stop_sequence SMALLINT
    );`);
    await GTFSParseDB.connection.execute('ALTER TABLE temp_stop_times ADD KEY `trip_id` (`trip_id`);');
    await GTFSParseDB.connection.execute('ALTER TABLE temp_stop_times ADD KEY `stop_id` (`stop_id`);');
    console.log('⤷ Created SQL table "temp_stop_times".');

    await GTFSParseDB.connection.execute(`CREATE TABLE temp_stops (
        stop_id VARCHAR(6),
        stop_name VARCHAR(255),
        stop_lat VARCHAR(10),
        stop_lon VARCHAR(10)
    );`);
    await GTFSParseDB.connection.execute('ALTER TABLE temp_stops ADD KEY `stop_id` (`stop_id`);');
    console.log('⤷ Created SQL table "temp_stops".');

    await GTFSParseDB.connection.execute(`CREATE TABLE temp_trips (
        route_id VARCHAR(255),
        service_id VARCHAR(255),
        trip_id VARCHAR(255),
        trip_headsign VARCHAR(255),
        direction_id TINYINT,
        shape_id VARCHAR(255)
    );`);
    await GTFSParseDB.connection.execute('ALTER TABLE temp_trips ADD KEY `route_id` (`route_id`);');
    await GTFSParseDB.connection.execute('ALTER TABLE temp_trips ADD KEY `route_id_service_id` (`route_id`, `service_id`);');
    console.log('⤷ Created SQL table "temp_trips".');

    console.log('⤷ All SQL tables created.');

    //
  },
};
