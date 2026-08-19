require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');
const routes = require('./routers');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/', routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PaperNet API listening on http://localhost:${PORT}`);
});

module.exports = app;