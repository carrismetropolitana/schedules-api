/* * */
/* IMPORTS */
const { mongoose } = require('mongoose');

/* * */
/* Schema for MongoDB ["Trip"] Object */
module.exports = new mongoose.Schema(
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
        stop: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Stop',
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
  { timestamps: true }
);
