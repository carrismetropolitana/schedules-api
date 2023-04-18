/* * */
/* IMPORTS */
const mongoose = require('mongoose');
const { GTFSAPIDB_USER, GTFSAPIDB_PASSWORD, GTFSAPIDB_HOST, GTFSAPIDB_NAME } = process.env;

class GTFSAPIDB {
  constructor() {
    this.connection = mongoose.createConnection(`mongodb://${GTFSAPIDB_USER}:${GTFSAPIDB_PASSWORD}@${GTFSAPIDB_HOST}/${GTFSAPIDB_NAME}?authSource=admin`);
    this.Line = this.connection.model('Line', require('../schemas/Line'));
    this.RouteSummary = this.connection.model('RouteSummary', require('../schemas/RouteSummary'));
    this.Route = this.connection.model('Route', require('../schemas/Route'));
    this.Stop = this.connection.model('Stop', require('../schemas/Stop'));
  }

  async connect() {
    try {
      await this.connection.openUri(`mongodb://${GTFSAPIDB_USER}:${GTFSAPIDB_PASSWORD}@${GTFSAPIDB_HOST}/${GTFSAPIDB_NAME}?authSource=admin`);
      console.log(`⤷ Connected to GTFSAPIDB.`);
    } catch (err) {
      console.log(`⤷X Failed to connect to GTFSAPIDB.`, err);
    }
  }

  async disconnect() {
    try {
      await this.connection.close();
      console.log(`⤷ Disconnected from GTFSAPIDB.`);
    } catch (err) {
      console.log(`⤷X Failed to disconnect from GTFSAPIDB.`, err);
    }
  }
}

module.exports = new GTFSAPIDB();
