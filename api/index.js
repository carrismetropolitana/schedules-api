/* * */
/* IMPORTS */
const express = require('express');
const app = express();
const GTFSAPIDB = require('./databases/gtfsapidb');
const rateLimit = require('express-rate-limit');

// Apply rate limiter to all requests: maximum of 50 requests per minute
app.use(
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 50, // Limit each IP to 50 requests per `window` (here, per 1 minute)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  })
);

// Set CORS Header globally
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

//
app.get('/lines/:route_short_name', async (req, res) => {
  try {
    const foundOneDocument = await GTFSAPIDB.Line.findOne({ route_short_name: req.params.route_short_name });
    if (foundOneDocument) {
      console.log('🟢 → Request for "/lines/%s": 1 Found', req.params.route_short_name);
      res.send(foundOneDocument);
    } else {
      console.log('🟡 → Request for "/lines/%s": Not Found', req.params.route_short_name);
      res.status(404).send({});
    }
  } catch (err) {
    console.log('🔴 → Request for "/lines/%s": Server Error', req.params.route_short_name, err);
    res.status(500).send({});
  }
});

//
app.get('/routes', async (req, res) => {
  try {
    const foundManyDocuments = await GTFSAPIDB.Route.find({});
    if (foundManyDocuments.length > 0) {
      foundManyDocuments.sort((a, b) => (a.route_id > b.route_id ? 1 : -1));
      console.log('🟢 → Request for "/routes/[all]": %s Found', foundManyDocuments.length);
      res.send(foundManyDocuments);
    } else {
      console.log('🟡 → Request for "/routes/[all]": Not Found');
      res.status(404).send([]);
    }
  } catch (err) {
    console.log('🔴 → Request for "/routes/[all]": Server Error', err);
    res.status(500).send([]);
  }
});

//
app.get('/routes/summary', async (req, res) => {
  try {
    const foundManyDocuments = await GTFSAPIDB.RouteSummary.find({});
    if (foundManyDocuments.length > 0) {
      foundManyDocuments.sort((a, b) => (a.route_id > b.route_id ? 1 : -1));
      console.log('🟢 → Request for "/routes/summary": %s Found', foundManyDocuments.length);
      res.send(foundManyDocuments);
    } else {
      console.log('🟡 → Request for "/routes/summary": Not Found');
      res.status(404).send([]);
    }
  } catch (err) {
    console.log('🔴 → Request for "/routes/summary": Server Error', err);
    res.status(500).send([]);
  }
});

//
app.get('/routes/route_id/:route_id', async (req, res) => {
  try {
    const foundOneDocument = await GTFSAPIDB.Route.findOne({ route_id: req.params.route_id });
    if (foundOneDocument) {
      console.log('🟢 → Request for "/routes/route_id/%s": 1 Found', req.params.route_id);
      res.send(foundOneDocument);
    } else {
      console.log('🟡 → Request for "/routes/route_id/%s": Not Found', req.params.route_id);
      res.status(404).send({});
    }
  } catch (err) {
    console.log('🔴 → Request for "/routes/route_id/%s": Server Error', req.params.route_id, err);
    res.status(500).send({});
  }
});

//
app.get('/routes/route_short_name/:route_short_name', async (req, res) => {
  try {
    const foundManyDocuments = await GTFSAPIDB.Route.find({ route_id: { $regex: `^${req.params.route_short_name}` } });
    if (foundManyDocuments.length > 0) {
      console.log('🟢 → Request for "/routes/route_short_name/%s": %s Found', req.params.route_short_name, foundManyDocuments.length);
      res.send(foundManyDocuments);
    } else {
      console.log('🟡 → Request for "/routes/route_short_name/%s": Not Found', req.params.route_short_name);
      res.status(404).send([]);
    }
  } catch (err) {
    console.log('🔴 → Request for "/routes/route_short_name/%s": Server Error', req.params.route_short_name, err);
    res.status(500).send([]);
  }
});

//
app.get('/stops', async (req, res) => {
  try {
    const foundManyDocuments = await GTFSAPIDB.Stop.find({}, 'stop_id stop_name stop_lat stop_lon routes');
    if (foundManyDocuments.length > 0) {
      foundManyDocuments.sort((a, b) => (a.stop_id > b.stop_id ? 1 : -1));
      console.log('🟢 → Request for "/stops/[all]": %s Found', foundManyDocuments.length);
      res.send(foundManyDocuments);
    } else {
      console.log('🟡 → Request for "/stops/[all]": Not Found');
      res.status(404).send([]);
    }
  } catch (err) {
    console.log('🔴 → Request for "/stops/[all]": Server Error', err);
    res.status(500).send([]);
  }
});

//
app.get('/stops/:stop_id', async (req, res) => {
  try {
    const foundOneDocument = await GTFSAPIDB.Stop.findOne({ stop_id: req.params.stop_id });
    if (foundOneDocument) {
      console.log('🟢 → Request for "/stops/%s": 1 Found', req.params.stop_id);
      res.send(foundOneDocument);
    } else {
      console.log('🟡 → Request for "/stops/%s": Not Found', req.params.stop_id);
      res.status(404).send({});
    }
  } catch (err) {
    console.log('🔴 → Request for "/stops/%s": Server Error', req.params.stop_id, err);
    res.status(500).send({});
  }
});

// set port, listen for requests
const PORT = 5050;
app.listen(5050, async () => {
  console.log('GTFS API listening on port %s...', PORT);
  await GTFSAPIDB.connect();
  console.log();
});
