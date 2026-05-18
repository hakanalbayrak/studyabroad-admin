require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/dashboard', require('./routes/api/dashboard'));
app.use('/api/entities', require('./routes/api/entities'));
app.use('/api/locations', require('./routes/api/locations'));
app.use('/api/programs', require('./routes/api/programs'));
app.use('/api/media', require('./routes/api/media'));
app.use('/api/orbit', require('./routes/api/orbit'));

app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
