const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 1. Connect to MongoDB (Local or Atlas)
mongoose.connect('mongodb://localhost:27017/mmms')
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ Connection Error:", err));

// 2. Data Models (Schemas)
// Update your UserSchema to look like this:
// index.js
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'hod', 'faculty', 'student'] },
    dept: String,
    subject: String,   // ✅ ADD THIS
    desig: String,     // ✅ ADD THIS
    section: String,
    marks: [{
        subject: { type: String, default: "Overall" },
        mid1: Number,
        mid2: Number,
        status: { type: String, default: 'Pending' }
    }]
});

const MarkSchema = new mongoose.Schema({
    username: String, // Student's username
    subject: String,
    mid1: Number,
    mid2: Number,
    status: { type: String, default: 'Pending' } // For HOD Approval
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
    console.log(req.body); // 👈 ADD THIS

    const user = await User.findOne({
        username: req.body.username,
        password: req.body.password,
        role: req.body.role
    });

    if (user) {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});
app.get("/students", async (req, res) => {
    try {
        const students = await User.find({ role: "student" });
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ADMIN: Add User (Student/Faculty/HOD)
app.post("/admin/add-user", async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.json({ msg: "User Added Successfully ✅" });
    } catch (err) {
        res.status(400).json({ msg: "Error: User exists or invalid data" });
    }
});
app.get("/students", async (req, res) => {
    const users = await User.find({ role: "student" });
    res.json(users);
});
app.delete("/admin/delete-user/:id", async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
});

// FACULTY: Add Marks
app.post("/marks", async (req, res) => {
    const { username, subject, mid1, mid2, role } = req.body;
    if (role === "student") return res.status(403).send("Denied");

    const mark = new Mark({ username, subject, mid1, mid2 });
    await mark.save();
    res.json({ msg: "Marks Submitted for Approval ✅" });
});

// HOD: Get Pending Approvals
app.get("/hod/pending/:dept", async (req, res) => {
    // Find students in this dept, then find their pending marks
    const studentsInDept = await User.find({ dept: req.params.dept, role: 'student' });
    const usernames = studentsInDept.map(s => s.username);
    const pendingMarks = await Mark.find({ username: { $in: usernames }, status: 'Pending' });
    res.json(pendingMarks);
});

// HOD: Approve/Reject
app.post("/hod/approve", async (req, res) => {
    const { markId, decision } = req.body; // decision: 'Approved' or 'Rejected'
    await Mark.findByIdAndUpdate(markId, { status: decision });
    res.json({ msg: `Marks ${decision}` });
});

// STUDENT: View Marks
app.get("/view-marks/:username", async (req, res) => {
    const marks = await Mark.find({ username: req.params.username, status: 'Approved' });
    res.json(marks);
});
// FACULTY: Submit marks for a student
app.post("/faculty/submit-marks", async (req, res) => {
    const { username, subject, mid1, mid2 } = req.body;

    try {
        const user = await User.findOne({ username });

        // ❗ If user not found
        if (!user) {
            return res.status(404).json({ msg: "User not found ❌" });
        }

        // ✅ Push marks
        user.marks.push({
            subject,
            mid1: Number(mid1),
            mid2: Number(mid2),
            status: "Pending"
        });

        await user.save();

        res.json({ msg: "Marks submitted successfully ✅" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error ❌" });
    }
});
// HOD: Get all students with pending marks
app.get("/hod/pending-marks", async (req, res) => {
    try {
        // Look for users where at least one mark in the array has status 'Pending'
        const students = await User.find({ "marks.status": "Pending" });
        res.json(students);
    } catch (err) {
        res.status(500).json({ msg: "Error fetching pending marks" });
    }
});
app.post("/admin/add-hod", async (req, res) => {
    const { username, dept } = req.body;

    try {
        const hod = new User({
            username: username,
            password: "123",   // ✅ REQUIRED
            role: "hod",
            dept: dept
        });

        await hod.save();

        res.json({ msg: "HOD Added ✅" });
    } catch (err) {
        console.log(err);
        res.json({ msg: "Error adding HOD ❌" });
    }
});

app.get("/hods", async (req, res) => {
    const hods = await User.find({ role: "hod" });
    res.json(hods);
});
app.post("/admin/add-faculty", async (req, res) => {
    const { name, dept, subject, desig } = req.body;

    try {
        const faculty = new User({
            username: name,
            password: "123",   // ✅ REQUIRED FIX
            role: "faculty",
            dept,
            subject,
            desig
        });

        await faculty.save();

        res.json({ msg: "Faculty Added ✅" });
    } catch (err) {
        console.error(err);
        res.status(400).json({ msg: "Error adding faculty ❌" });
    }
});
app.get("/faculty", async (req, res) => {
    const faculty = await User.find({ role: "faculty" });
    res.json(faculty);
});

// HOD: Approve a specific mark
app.post("/hod/approve-mark", async (req, res) => {
    const { username, subject } = req.body;
    try {
        await User.updateOne(
            { username: username, "marks.subject": subject },
            { $set: { "marks.$.status": "Approved" } } // The '$' targets the specific mark found
        );
        res.json({ msg: "Mark Approved! ✅" });
    } catch (err) {
        res.status(500).json({ msg: "Approval failed" });
    }
});
// GET all students with marks
app.get("/faculty/students/:section", async (req, res) => {
    try {
        const students = await User.find({
            role: "student",
            section: req.params.section   // ✅ FILTER HERE
        });
        res.json(students);
    } catch (err) {
        res.status(500).json({ msg: "Error fetching students" });
    }
});
app.delete("/admin/delete-user/:username", async (req, res) => {
    await User.deleteOne({ username: req.params.username });
    res.json({ msg: "User deleted" });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));