require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// health route (Render needs a working route)
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// 🔐 Check env first (prevents crash)
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI not set");
  process.exit(1);
}

// 🚀 Connect DB then start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("❌ DB Error:", err.message);
    process.exit(1); // fail fast so logs show error
  });
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'hod', 'faculty', 'student'] },
    dept: String,
    subject: String,
    desig: String,
    section: String,
    marks: [{
        subject: { type: String, default: "Overall" },
        mid1: Number,
        mid2: Number,
        status: { type: String, default: 'Pending' }
    }]
});

const MarkSchema = new mongoose.Schema({
    username: String,
    subject: String,
    mid1: Number,
    mid2: Number,
    status: { type: String, default: 'Pending' }
});

const AttendanceSchema = new mongoose.Schema({
    username: String,
    subject: String,
    percent: Number
});

const User = mongoose.model('User', UserSchema);
const Mark = mongoose.model('Mark', MarkSchema);
const Attendance = mongoose.model('Attendance', AttendanceSchema);

/* ================= ROUTES ================= */

// LOGIN
app.post("/login", async (req, res) => {
    try {
        const user = await User.findOne(req.body);
        res.json({ success: !!user });
    } catch (err) {
        res.status(500).json({ msg: "Server error" });
    }
});

// GET STUDENTS
app.get("/students", async (req, res) => {
    try {
        const students = await User.find({ role: "student" });
        res.json(students);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// ADD USER (ADMIN)
app.post("/admin/add-user", async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.json({ msg: "User Added ✅" });
    } catch (err) {
        res.status(400).json({ msg: "User exists or invalid data ❌" });
    }
});

// DELETE USER
app.delete("/admin/delete-user/:username", async (req, res) => {
    await User.deleteOne({ username: req.params.username });
    res.json({ msg: "User deleted" });
});

// ADD MARKS
app.post("/marks", async (req, res) => {
    const { username, subject, mid1, mid2, role } = req.body;

    if (role === "student") {
        return res.status(403).send("Denied");
    }

    const mark = new Mark({ username, subject, mid1, mid2 });
    await mark.save();

    res.json({ msg: "Marks submitted ✅" });
});

// VIEW MARKS (STUDENT)
app.get("/view-marks/:username", async (req, res) => {
    const marks = await Mark.find({
        username: req.params.username,
        status: "Approved"
    });
    res.json(marks);
});

// FACULTY SUBMIT MARKS
app.post("/faculty/submit-marks", async (req, res) => {
    const { username, subject, mid1, mid2 } = req.body;

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ msg: "User not found ❌" });
        }

        user.marks.push({
            subject,
            mid1: Number(mid1),
            mid2: Number(mid2),
            status: "Pending"
        });

        await user.save();

        res.json({ msg: "Marks submitted ✅" });

    } catch (err) {
        res.status(500).json({ msg: "Server error ❌" });
    }
});

// HOD PENDING MARKS
app.get("/hod/pending-marks", async (req, res) => {
    try {
        const students = await User.find({ "marks.status": "Pending" });
        res.json(students);
    } catch (err) {
        res.status(500).json({ msg: "Error ❌" });
    }
});

// HOD APPROVE MARK
app.post("/hod/approve-mark", async (req, res) => {
    const { username, subject } = req.body;

    try {
        await User.updateOne(
            { username, "marks.subject": subject },
            { $set: { "marks.$.status": "Approved" } }
        );

        res.json({ msg: "Approved ✅" });

    } catch (err) {
        res.status(500).json({ msg: "Failed ❌" });
    }
});

// ADD HOD
app.post("/admin/add-hod", async (req, res) => {
    const { username, dept } = req.body;

    try {
        const hod = new User({
            username,
            password: "123",
            role: "hod",
            dept
        });

        await hod.save();
        res.json({ msg: "HOD Added ✅" });

    } catch (err) {
        res.json({ msg: "Error ❌" });
    }
});

// GET HODS
app.get("/hods", async (req, res) => {
    const hods = await User.find({ role: "hod" });
    res.json(hods);
});

// ADD FACULTY
app.post("/admin/add-faculty", async (req, res) => {
    const { name, dept, subject, desig } = req.body;

    try {
        const faculty = new User({
            username: name,
            password: "123",
            role: "faculty",
            dept,
            subject,
            desig
        });

        await faculty.save();
        res.json({ msg: "Faculty Added ✅" });

    } catch (err) {
        res.status(400).json({ msg: "Error ❌" });
    }
});

// GET FACULTY
app.get("/faculty", async (req, res) => {
    const faculty = await User.find({ role: "faculty" });
    res.json(faculty);
});

// GET STUDENTS BY SECTION
app.get("/faculty/students/:section", async (req, res) => {
    try {
        const students = await User.find({
            role: "student",
            section: req.params.section
        });
        res.json(students);
    } catch (err) {
        res.status(500).json({ msg: "Error ❌" });
    }
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});