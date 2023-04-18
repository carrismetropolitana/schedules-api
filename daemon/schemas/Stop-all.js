/* * */
/* IMPORTS */
const { mongoose } = require('mongoose');

/* * */
/* Schema for MongoDB ["Stop"] Object */
module.exports = new mongoose.Schema(
  {
    stop_id: {
      type: String,
      maxlength: 100,
      unique: true,
    },
    stop_name: {
      type: String,
      maxlength: 100,
    },
    stop_lat: {
      type: String,
      maxlength: 100,
    },
    stop_lon: {
      type: String,
      maxlength: 100,
    },
    routes: [
      {
        route_id: {
          type: String,
          maxlength: 100,
        },
        route_short_name: {
          type: String,
          maxlength: 100,
        },
        route_long_name: {
          type: String,
          maxlength: 100,
        },
        route_color: {
          type: String,
          maxlength: 100,
        },
        route_text_color: {
          type: String,
          maxlength: 100,
        },
        municipalities: [
          {
            id: {
              type: String,
              maxlength: 100,
            },
            value: {
              type: String,
              maxlength: 100,
            },
          },
        ],
      },
    ],
    schedule: [
      {
        route_id: {
          type: String,
          maxlength: 100,
        },
        route_short_name: {
          type: String,
          maxlength: 100,
        },
        route_color: {
          type: String,
          maxlength: 100,
        },
        route_text_color: {
          type: String,
          maxlength: 100,
        },
        trip_id: {
          type: String,
          maxlength: 100,
        },
        direction_id: {
          type: String,
          maxlength: 100,
        },
        trip_headsign: {
          type: String,
          maxlength: 100,
        },
        dates: [
          {
            type: String,
            maxlength: 100,
          },
        ],
        stop_sequence: {
          type: String,
          maxlength: 100,
        },
        departure_time: {
          type: String,
          maxlength: 100,
        },
        departure_time_operation: {
          type: String,
          maxlength: 100,
        },
      },
    ],
  },
  { timestamps: true }
);
