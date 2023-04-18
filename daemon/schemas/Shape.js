/* * */
/* IMPORTS */
const { mongoose } = require('mongoose');

/* * */
/* Schema for MongoDB ["Shape"] Object */
module.exports = new mongoose.Schema(
  {
    shape_id: {
      type: String,
      maxlength: 100,
      unique: true,
    },
    points: [
      {
        shape_pt_lat: {
          type: String,
          maxlength: 100,
        },
        shape_pt_lon: {
          type: String,
          maxlength: 100,
        },
        shape_pt_sequence: {
          type: String,
          maxlength: 100,
        },
        shape_dist_traveled: {
          type: String,
          maxlength: 100,
        },
      },
    ],
    geojson: {
      type: {
        type: String,
        maxlength: 100,
      },
      geometry: {
        type: {
          type: String,
          maxlength: 100,
        },
        coordinates: [
          [
            {
              type: Number,
              maxlength: 100,
            },
          ],
        ],
      },
    },
  },
  { timestamps: true }
);
