require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


// Middleware
app.use(cors()); // Allows your frontend to talk to backend
app.use(express.json()); // Parse JSON request bodies

// In-memory "database" (for learning - replace with real DB later)
let users = [];

// Sign up endpoint
app.post('/api/auth/signup', (req, res) => {
  const { fullName, email, username, password } = req.body;
  
  // Validation (server-side too!)
  if (!fullName || !email || !username || !password) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }
  
  // Check if email already exists
  if (users.find(u => u.email === email)) {
    return res.status(400).json({
      success: false,
      message: 'Email already registered'
    });
  }
  
  // Check if username already exists
  if (users.find(u => u.username === username)) {
    return res.status(400).json({
      success: false,
      message: 'Username already taken'
    });
  }
  
  // In real app, hash password with bcrypt before saving
  const newUser = {
    id: Date.now(),
    fullName,
    email,
    username,
    password, // ⚠️ In production, hash this!
    createdAt: new Date()
  };
  
  users.push(newUser);
  
  res.status(201).json({
    success: true,
    message: 'Account created successfully!',
    user: { id: newUser.id, email: newUser.email, username: newUser.username }
  });
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }
  
  const user = users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }
  
  res.json({
    success: true,
    message: 'Login successful',
    user: { id: user.id, email: user.email, username: user.username }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Signup endpoint: http://localhost:${PORT}/api/auth/signup`);
});