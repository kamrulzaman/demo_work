const express = require('express');
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(verifyToken);
router.use(requireRole(['admin', 'researcher']));

// Get dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const [pendingBookings] = await db.query('SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND status = "pending"', [req.userId]);
        const [activeExperiments] = await db.query('SELECT COUNT(*) as count FROM experiments WHERE user_id = ? AND status = "active"', [req.userId]);
        const [completedResults] = await db.query('SELECT COUNT(*) as count FROM experiment_results WHERE experiment_id IN (SELECT id FROM experiments WHERE user_id = ?)', [req.userId]);
        
        res.json({
            success: true,
            stats: {
                pendingBookings: pendingBookings[0].count,
                activeExperiments: activeExperiments[0].count,
                completedResults: completedResults[0].count
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get available equipment
router.get('/equipment', async (req, res) => {
    try {
        const [equipment] = await db.query('SELECT * FROM equipment WHERE status IN ("available", "inuse") ORDER BY name');
        res.json({ success: true, equipment });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Create booking request
router.post('/bookings', async (req, res) => {
    const { equipment_id, start_time, end_time, purpose } = req.body;
    
    try {
        // Check for overlapping bookings
        const [overlapping] = await db.query(
            `SELECT id FROM bookings 
             WHERE equipment_id = ? AND status IN ('pending', 'approved')
             AND ((start_time BETWEEN ? AND ?) OR (end_time BETWEEN ? AND ?))`,
            [equipment_id, start_time, end_time, start_time, end_time]
        );
        
        if (overlapping.length > 0) {
            return res.status(400).json({ success: false, message: 'Equipment already booked for this time slot.' });
        }
        
        const [result] = await db.query(
            'INSERT INTO bookings (user_id, equipment_id, start_time, end_time, purpose) VALUES (?, ?, ?, ?, ?)',
            [req.userId, equipment_id, start_time, end_time, purpose]
        );
        
        res.json({ success: true, message: 'Booking request submitted.', bookingId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get my bookings
router.get('/my-bookings', async (req, res) => {
    try {
        const [bookings] = await db.query(`
            SELECT b.*, e.name as equipment_name
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

// Get my experiments
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

// Create/Update experiment
router.post('/experiments', async (req, res) => {
    const { booking_id, title, equipment_used, progress, notes } = req.body;
    
    try {
        // Check if experiment already exists for this booking
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
        
        res.json({ success: true, message: 'Experiment saved.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Upload experiment result
router.post('/upload-result', upload.single('resultFile'), async (req, res) => {
    const { experiment_id, title, conclusion } = req.body;
    const filePath = req.file ? req.file.path : null;
    const fileName = req.file ? req.file.originalname : null;
    
    try {
        await db.query(
            'INSERT INTO experiment_results (experiment_id, title, file_path, file_name, conclusion) VALUES (?, ?, ?, ?, ?)',
            [experiment_id, title, filePath, fileName, conclusion]
        );
        
        // Update experiment status to completed if not already
        await db.query('UPDATE experiments SET status = "completed", completed_at = NOW() WHERE id = ? AND progress >= 100', [experiment_id]);
        
        res.json({ success: true, message: 'Result uploaded successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get my results
router.get('/my-results', async (req, res) => {
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

// Get SOP documents
router.get('/sop', async (req, res) => {
    try {
        const [sopDocs] = await db.query('SELECT * FROM sop_documents ORDER BY uploaded_at DESC');
        res.json({ success: true, sopDocs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Report damage
router.post('/damage-reports', async (req, res) => {
    const { equipment_id, severity, description } = req.body;
    
    try {
        await db.query(
            'INSERT INTO damage_reports (equipment_id, reported_by, severity, description) VALUES (?, ?, ?, ?)',
            [equipment_id, req.userId, severity, description]
        );
        
        res.json({ success: true, message: 'Damage report submitted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;