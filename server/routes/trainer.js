import express from 'express';
import { trainerOnly } from '../middleware/admin.js';
import { pool } from '../db.js';

const router = express.Router();

// Get trainer's classes for a date range
router.get('/classes', trainerOnly, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const trainerId = req.user.id;

    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'start_date and end_date are required' });
    }

    const query = `
      SELECT 
        c.id,
        c.title,
        c.description,
        c.class_date::text as class_date,
        c.start_time,
        c.end_time,
        c.place,
        ct.name as type_name,
        COUNT(b.id) as attendees_count
      FROM classes c
      LEFT JOIN class_types ct ON c.type_id = ct.id
      LEFT JOIN bookings b ON c.id = b.class_id AND b.status = 'booked'
      WHERE c.trainer_id = $1 
        AND c.class_date >= $2 
        AND c.class_date <= $3
      GROUP BY c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.place, ct.name
      ORDER BY c.class_date, c.start_time
    `;

    const result = await pool.query(query, [trainerId, start_date, end_date]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching trainer classes:', error);
    res.status(500).json({ message: 'Ошибка загрузки занятий' });
  }
});

// Get class details and attendees
router.get('/classes/:id/attendees', trainerOnly, async (req, res) => {
  try {
    const classId = req.params.id;
    const trainerId = req.user.id;

    // First verify the class belongs to this trainer
    const classQuery = `
      SELECT 
        c.id,
        c.title,
        c.description,
        c.class_date::text as class_date,
        c.start_time,
        c.end_time,
        c.place,
        ct.name as type_name
      FROM classes c
      LEFT JOIN class_types ct ON c.type_id = ct.id
      WHERE c.id = $1 AND c.trainer_id = $2
    `;

    const classResult = await pool.query(classQuery, [classId, trainerId]);
    
    if (classResult.rows.length === 0) {
      return res.status(404).json({ message: 'Занятие не найдено' });
    }

    // Get attendees with attendance status
    const attendeesQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        b.id as booking_id,
        a.status as attendance_status,
        a.marked_at as attendance_marked_at
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN attendance a ON b.id = a.booking_id
      WHERE b.class_id = $1
      ORDER BY u.last_name, u.first_name
    `;

    const attendeesResult = await pool.query(attendeesQuery, [classId]);

    res.json({
      class: classResult.rows[0],
      attendees: attendeesResult.rows
    });
  } catch (error) {
    console.error('Error fetching class attendees:', error);
    res.status(500).json({ message: 'Ошибка загрузки участников' });
  }
});

// Mark attendance for a booking
router.post('/classes/:classId/attendance/:bookingId', trainerOnly, async (req, res) => {
  try {
    const { classId, bookingId } = req.params;
    const { status } = req.body; // 'attended', 'absent', or 'late'
    const trainerId = req.user.id;

    if (!['attended', 'absent', 'late'].includes(status)) {
      return res.status(400).json({ message: 'Неверный статус посещаемости' });
    }

    // First verify the class belongs to this trainer and the booking exists
    const verifyQuery = `
      SELECT b.id 
      FROM bookings b
      JOIN classes c ON b.class_id = c.id
      WHERE b.id = $1 AND c.id = $2 AND c.trainer_id = $3
    `;
    
    const verifyResult = await pool.query(verifyQuery, [bookingId, classId, trainerId]);
    
    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ message: 'Бронирование не найдено' });
    }

    // Get class duration for progress calculation
    const classQuery = `
      SELECT c.duration_minutes, b.user_id
      FROM classes c
      JOIN bookings b ON c.id = b.class_id
      WHERE b.id = $1
    `;
    
    const classResult = await pool.query(classQuery, [bookingId]);
    if (classResult.rows.length === 0) {
      return res.status(404).json({ message: 'Класс не найден' });
    }
    
    const { duration_minutes, user_id } = classResult.rows[0];

    // Insert or update attendance record
    const attendanceQuery = `
      INSERT INTO attendance (booking_id, status, marked_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (booking_id) 
      DO UPDATE SET 
        status = EXCLUDED.status,
        marked_at = EXCLUDED.marked_at
      RETURNING id, status, marked_at
    `;

    const result = await pool.query(attendanceQuery, [bookingId, status]);
    
    // Update user progress if marked as attended
    if (status === 'attended') {
      // Check if this attendance was already marked to avoid double counting
      const checkExistingQuery = `
        SELECT status FROM attendance WHERE booking_id = $1
      `;
      const existingResult = await pool.query(checkExistingQuery, [bookingId]);
      
      // Only update if this is a new attendance record or changing from non-attended to attended
      if (existingResult.rows.length === 0 || existingResult.rows[0].status !== 'attended') {
        const updateProgressQuery = `
          UPDATE users 
          SET 
            visits_count = visits_count + 1,
            minutes_practice = minutes_practice + $1
          WHERE id = $2
        `;
        await pool.query(updateProgressQuery, [duration_minutes, user_id]);
      }
    }
    
    res.json({
      message: 'Посещаемость отмечена',
      attendance: result.rows[0]
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ message: 'Ошибка отметки посещаемости' });
  }
});

export default router;
