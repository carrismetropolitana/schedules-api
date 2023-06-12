/* * */
/* IMPORTS */
const { mongoose } = require('mongoose');

/* * */
/* Schema for MongoDB ["Line"] Object */
module.exports = new mongoose.Schema(
  {
    code: {
      type: String,
      maxlength: 100,
      unique: true,
    },
    short_name: {
      type: String,
      maxlength: 100,
    },
    long_name: {
      type: String,
      maxlength: 100,
    },
    color: {
      type: String,
      maxlength: 7,
    },
    text_color: {
      type: String,
      maxlength: 7,
    },
    municipalities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Municipality',
      },
    ],
  },
  {
    id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    virtuals: {
      patterns: {
        options: {
          ref: 'Pattern',
          localField: '_id',
          foreignField: 'parent_line',
        },
      },
    },
  }
);
