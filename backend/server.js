

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const announcementRoutes = require('./routes/announcements');
const groupRoutes        = require('./routes/groups');
const eventRoutes        = require('./routes/events');
const formTemplatesRouter = require('./routes/formTemplates');
const youtubeRoutes = require("./routes/youtube");

const errorHandler       = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => res.json({ success: true, message: 'Church Portal API running' }));
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/groups',        groupRoutes);
app.use('/api/events',        eventRoutes);
app.use('/api/form-templates', formTemplatesRouter);

app.use("/api/youtube", youtubeRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

app.listen(PORT, () => console.log(`✅ Church Portal API running on http://localhost:${PORT}`));
