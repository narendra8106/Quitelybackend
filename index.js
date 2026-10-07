require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const checkRoutes = require('./routes/checkRoutes');
const itemsRoutes = require('./routes/itemsRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Health check - useful to confirm deployment is alive before a demo
app.get('/', (req, res) => {
  res.json({ status: 'Quietly backend running' });
});

app.use('/api', checkRoutes);
app.use('/api', itemsRoutes);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Quietly backend listening on port ${PORT}`);
  });
});
