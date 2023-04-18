/* * */
/* IMPORTS */
const mongoose = require('mongoose');
const { GTFSAPIDB_USER, GTFSAPIDB_PASSWORD, GTFSAPIDB_HOST, GTFSAPIDB_NAME } = process.env;

class GTFSAPIDB {
  constructor() {
    this.connection = mongoose.createConnection(`mongodb://${GTFSAPIDB_USER}:${GTFSAPIDB_PASSWORD}@${GTFSAPIDB_HOST}/${GTFSAPIDB_NAME}?authSource=admin`);
    this.Line = this.connection.model('Line', require('../schemas/Line'));
    this.Shape = this.connection.model('Shape', require('../schemas/Shape'));
    this.Stop = this.connection.model('Stop', require('../schemas/Stop'));
  }

  async connect() {
    await this.connection.openUri(`mongodb://${GTFSAPIDB_USER}:${GTFSAPIDB_PASSWORD}@${GTFSAPIDB_HOST}/${GTFSAPIDB_NAME}?authSource=admin`);
    console.log(`⤷ Connected to GTFSAPIDB.`);
  }

  async disconnect() {
    await this.connection.close();
    console.log(`⤷ Disconnected from GTFSAPIDB.`);
  }
}

module.exports = new GTFSAPIDB();
