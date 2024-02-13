require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const whatsappRoutes = require('./routes');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.use('/', whatsappRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});