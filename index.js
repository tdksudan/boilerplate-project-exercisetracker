const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');
const router = express.Router(); // Properly initialize the router

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(express.json()); // Parse JSON data
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded form data

// Landing page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// MongoDB Connection
const URI = process.env.MONGO_URI;
mongoose.connect(URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas and Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
});
const User = mongoose.model('User', userSchema);

const exerciseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});
const Exercise = mongoose.model('Exercise', exerciseSchema);

// Routes
// POST: Create a new user
router.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    const newUser = new User({ username });
    await newUser.save();

    res.json({ username: newUser.username, _id: newUser._id });
  } catch (err) {
    if (err.code === 11000) { // Handle duplicate usernames
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Could not create user' });
    }
  }
});

// GET: Retrieve all users
router.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username _id'); // Select only username and _id fields
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Could not retrieve users' });
  }
});

// POST: Add an exercise for a user
router.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const { _id } = req.params;
    const { description, duration, date } = req.body;

    const user = await User.findById(_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!description || !duration) {
      return res.status(400).json({ error: 'Description and duration are required' });
    }

    const newExercise = new Exercise({
      userId: _id,
      description,
      duration: parseInt(duration),
      date: date ? new Date(date) : new Date(),
    });

    await newExercise.save();

    res.json({
      username: user.username,
      description: newExercise.description,
      duration: newExercise.duration,
      date: newExercise.date.toDateString(),
      _id: user._id,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error adding exercise' });
  }
});

// GET: Retrieve a user's exercise log
router.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const { _id } = req.params;
    const { from, to, limit } = req.query;

    const user = await User.findById(_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let query = { userId: _id };

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }

    const log = await Exercise.find(query).limit(parseInt(limit) || 100);

    res.json({
      username: user.username,
      count: log.length,
      _id: user._id,
      log: log.map((entry) => ({
        description: entry.description,
        duration: entry.duration,
        date: entry.date.toDateString(),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving logs' });
  }
});

// Apply router
app.use(router);

// Start server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});