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
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pattern',
      },
    ],
  },
  { timestamps: true }
);
