/* * */
/* IMPORTS */
const { mongoose } = require('mongoose');

/* * */
/* Schema for MongoDB ["Line"] Object */
module.exports = new mongoose.Schema(
  {
    route_ids: [
      {
        type: String,
        maxlength: 100,
      },
    ],
    route_short_name: {
      type: String,
      maxlength: 100,
      unique: true,
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
    patterns: [
      {
        pattern_id: {
          type: String,
          maxlength: 100,
        },
        direction_id: {
          type: String,
          maxlength: 100,
        },
        headsign: {
          type: String,
          maxlength: 100,
        },
        trips: [
          {
            trip_id: {
              type: String,
              maxlength: 100,
              unique: true,
            },
            shape_id: {
              type: String,
              maxlength: 100,
            },
            calendar_desc: {
              type: String,
              maxlength: 100,
            },
            dates: [
              {
                type: String,
                maxlength: 8,
              },
            ],
            schedule: [
              {
                stop_id: {
                  type: String,
                  maxlength: 6,
                },
                stop_sequence: {
                  type: String,
                  maxlength: 5,
                },
                arrival_time: {
                  type: String,
                  maxlength: 8,
                },
                arrival_time_operation: {
                  type: String,
                  maxlength: 8,
                },
                departure_time: {
                  type: String,
                  maxlength: 8,
                },
                departure_time_operation: {
                  type: String,
                  maxlength: 8,
                },
              },
            ],
          },
        ],
      },
    ],
  },
  { timestamps: true }
);
