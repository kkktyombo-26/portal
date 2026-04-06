

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const announcementRoutes = require('./routes/announcements');
const emailRoutes        = require('./routes/email-routes');
const groupRoutes        = require('./routes/groups');
const eventRoutes        = require('./routes/events');
const formTemplatesRouter = require('./routes/formTemplates');
const youtubeRoutes = require("./routes/youtube");
const waRoutes = require("./routes/whatsapp");

const errorHandler       = require('./middleware/errorHandler')

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));


// Allow large video files (adjust size as needed)
app.use(express.json({ limit: "10gb" }));
app.use(express.urlencoded({ limit: "10gb", extended: true }));

app.get('/api/health', (req, res) => res.json({ success: true, message: 'Church Portal API running' }));
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/groups',        groupRoutes);
app.use('/api/events',        eventRoutes);
app.use('/api/form-templates', formTemplatesRouter);

app.use('/emails', emailRoutes);

 app.use("/api/whatsapp", waRoutes);

app.use("/api/youtube", youtubeRoutes);

app.use("/api/youtube/upload", require("./routes/upload"));

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

app.listen(PORT, () => console.log(`✅ Church Portal API running on http://localhost:${PORT}`));
