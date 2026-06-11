const express = require('express');
const db = require('../config/database');
const { verifyToken, isSupervisor } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, isSupervisor);

// Get dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const [pendingBookings] = await db.query('SELECT COUNT(*) as count FROM bookings WHERE status = "pending"');
        const [activeExperiments] = await db.query('SELECT COUNT(*) as count FROM experiments WHERE status = "active"');
        const [availableEquipment] = await db.query('SELECT COUNT(*) as count FROM equipment WHERE status = "available"');
        
        res.json({
            success: true,
            stats: {
                pendingBookings: pendingBookings[0].count,
                activeExperiments: activeExperiments[0].count,
                availableEquipment: availableEquipment[0].count
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all bookings with filters
router.get('/bookings', async (req, res) => {
    const { status } = req.query;
    
    try {
        let query = `
            SELECT b.*, u.full_name as user_name, u.email, e.name as equipment_name
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            JOIN equipment e ON b.equipment_id = e.id
        `;
        const params = [];
        
        if (status && status !== 'all') {
            query += ' WHERE b.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY b.created_at DESC';
        
        const [bookings] = await db.query(query, params);
        res.json({ success: true, bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Update booking status
router.put('/bookings/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        await db.query(
            'UPDATE bookings SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
            [status, req.userId, id]
        );
        
        // Log activity
        await db.query(
            'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
            [req.userId, `Updated booking ${id} to ${status}`]
        );
        
        res.json({ success: true, message: `Booking ${status} successfully.` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all equipment
router.get('/equipment', async (req, res) => {
    try {
        const [equipment] = await db.query('SELECT * FROM equipment ORDER BY name');
        res.json({ success: true, equipment });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Update equipment status
router.put('/equipment/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        await db.query('UPDATE equipment SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true, message: 'Equipment status updated.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all experiments
router.get('/experiments', async (req, res) => {
    try {
        const [experiments] = await db.query(`
            SELECT e.*, u.full_name as researcher_name, eq.name as equipment_name
            FROM experiments e
            JOIN users u ON e.user_id = u.id
            LEFT JOIN equipment eq ON eq.id = ?
            ORDER BY e.started_at DESC
        `, []);
        res.json({ success: true, experiments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Update experiment progress
router.put('/experiments/:id/progress', async (req, res) => {
    const { id } = req.params;
    const { progress, notes } = req.body;
    
    try {
        let status = 'active';
        let completedAt = null;
        
        if (progress >= 100) {
            status = 'completed';
            completedAt = new Date();
        }
        
        await db.query(
            'UPDATE experiments SET progress = ?, status = ?, notes = ?, completed_at = ? WHERE id = ?',
            [progress, status, notes, completedAt, id]
        );
        
        res.json({ success: true, message: 'Experiment progress updated.' });
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

// Upload SOP document
router.post('/sop', async (req, res) => {
    const { title, equipment_type, document_type, description } = req.body;
    
    try {
        await db.query(
            'INSERT INTO sop_documents (title, equipment_type, document_type, description, uploaded_by) VALUES (?, ?, ?, ?, ?)',
            [title, equipment_type, document_type, description, req.userId]
        );
        
        res.json({ success: true, message: 'SOP document added.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get damage reports
router.get('/damage-reports', async (req, res) => {
    try {
        const [reports] = await db.query(`
            SELECT dr.*, e.name as equipment_name, u.full_name as reported_by_name
            FROM damage_reports dr
            JOIN equipment e ON dr.equipment_id = e.id
            JOIN users u ON dr.reported_by = u.id
            ORDER BY dr.reported_at DESC
        `);
        res.json({ success: true, reports });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Add damage report
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