const express = require('express');
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(verifyToken);
router.use(requireRole(['admin', 'student']));

// Get dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const [pendingBookings] = await db.query('SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND status = "pending"', [req.userId]);
        const [activeExperiments] = await db.query('SELECT COUNT(*) as count FROM experiments WHERE user_id = ? AND status = "active"', [req.userId]);
        const [submittedAssignments] = await db.query('SELECT COUNT(*) as count FROM experiment_results WHERE experiment_id IN (SELECT id FROM experiments WHERE user_id = ?)', [req.userId]);
        
        res.json({
            success: true,
            stats: {
                pendingBookings: pendingBookings[0].count,
                activeExperiments: activeExperiments[0].count,
                submittedAssignments: submittedAssignments[0].count
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get available lab stations (equipment)
router.get('/stations', async (req, res) => {
    try {
        const [stations] = await db.query('SELECT id, name, location, status FROM equipment WHERE category IN ("Lab Station", "Computer Lab", "Workstation") OR status = "available"');
        res.json({ success: true, stations });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Create desk booking
router.post('/bookings', async (req, res) => {
    const { equipment_id, start_time, end_time, purpose } = req.body;
    
    try {
        const [result] = await db.query(
            'INSERT INTO bookings (user_id, equipment_id, start_time, end_time, purpose) VALUES (?, ?, ?, ?, ?)',
            [req.userId, equipment_id, start_time, end_time, purpose]
        );
        
        res.json({ success: true, message: 'Desk booking request submitted.', bookingId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get my desk bookings
router.get('/my-bookings', async (req, res) => {
    try {
        const [bookings] = await db.query(`
            SELECT b.*, e.name as station_name
            FROM bookings b
            JOIN equipment e ON b.equipment_id = e.id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
        `, [req.userId]);
        
        res.json({ success: true, bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get my experiments/assignments
router.get('/my-experiments', async (req, res) => {
    try {
        const [experiments] = await db.query(`
            SELECT e.*, b.equipment_id, eq.name as equipment_name
            FROM experiments e
            LEFT JOIN bookings b ON e.booking_id = b.id
            LEFT JOIN equipment eq ON b.equipment_id = eq.id
            WHERE e.user_id = ?
            ORDER BY e.started_at DESC
        `, [req.userId]);
        
        res.json({ success: true, experiments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Create/Update student experiment
router.post('/experiments', async (req, res) => {
    const { booking_id, title, equipment_used, progress, notes } = req.body;
    
    try {
        const [existing] = await db.query('SELECT id FROM experiments WHERE booking_id = ? AND user_id = ?', [booking_id, req.userId]);
        
        let status = 'active';
        let completedAt = null;
        if (progress >= 100) {
            status = 'completed';
            completedAt = new Date();
        }
        
        if (existing.length > 0) {
            await db.query(
                'UPDATE experiments SET progress = ?, status = ?, notes = ?, completed_at = ? WHERE id = ?',
                [progress, status, notes, completedAt, existing[0].id]
            );
        } else {
            await db.query(
                'INSERT INTO experiments (user_id, booking_id, title, equipment_used, progress, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [req.userId, booking_id, title, equipment_used, progress, status, notes]
            );
        }
        
        res.json({ success: true, message: 'Assignment progress saved.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Upload assignment
router.post('/upload-assignment', upload.single('assignFile'), async (req, res) => {
    const { experiment_id, title, conclusion } = req.body;
    const filePath = req.file ? req.file.path : null;
    const fileName = req.file ? req.file.originalname : null;
    
    try {
        await db.query(
            'INSERT INTO experiment_results (experiment_id, title, file_path, file_name, conclusion) VALUES (?, ?, ?, ?, ?)',
            [experiment_id, title, filePath, fileName, conclusion]
        );
        
        res.json({ success: true, message: 'Assignment submitted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get submitted assignments
router.get('/my-submissions', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT er.*, e.title as experiment_title
            FROM experiment_results er
            JOIN experiments e ON er.experiment_id = e.id
            WHERE e.user_id = ?
            ORDER BY er.uploaded_at DESC
        `, [req.userId]);
        
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get lab manuals (SOPs)
router.get('/manuals', async (req, res) => {
    try {
        const [manuals] = await db.query('SELECT * FROM sop_documents WHERE document_type IN ("manual", "sop") ORDER BY uploaded_at DESC');
        res.json({ success: true, manuals });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Report issue
router.post('/issues', async (req, res) => {
    const { equipment_id, severity, description } = req.body;
    
    try {
        await db.query(
            'INSERT INTO damage_reports (equipment_id, reported_by, severity, description) VALUES (?, ?, ?, ?)',
            [equipment_id, req.userId, severity, description]
        );
        
        res.json({ success: true, message: 'Issue reported successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get my reported issues
router.get('/my-issues', async (req, res) => {
    try {
        const [issues] = await db.query(`
            SELECT dr.*, e.name as equipment_name
            FROM damage_reports dr
            JOIN equipment e ON dr.equipment_id = e.id
            WHERE dr.reported_by = ?
            ORDER BY dr.reported_at DESC
        `, [req.userId]);
        
        res.json({ success: true, issues });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;