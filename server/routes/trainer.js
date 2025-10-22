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
        c.class_date as class_date,
        c.start_time,
        c.end_time,
        c.place,
        ct.name as type_name,
        COUNT(b.id) as attendees_count
      FROM classes c
      LEFT JOIN class_types ct ON c.type_id = ct.id
      LEFT JOIN bookings b ON c.id = b.class_id AND b.status = 'booked'
      WHERE c.trainer_id = ? 
        AND c.class_date >= ? 
        AND c.class_date <= ?
      GROUP BY c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.place, ct.name
      ORDER BY c.class_date, c.start_time
    `;

    const [result] = await pool.query(query, [trainerId, start_date, end_date]);
    
    // Форматируем даты для избежания проблем с часовыми поясами
    const formattedResult = result.map(row => ({
      ...row,
      class_date: row.class_date ? 
        `${row.class_date.getFullYear()}-${String(row.class_date.getMonth() + 1).padStart(2, '0')}-${String(row.class_date.getDate()).padStart(2, '0')}` : 
        null
    }));
    
    res.json(formattedResult);
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
        c.class_date as class_date,
        c.start_time,
        c.end_time,
        c.place,
        ct.name as type_name
      FROM classes c
      LEFT JOIN class_types ct ON c.type_id = ct.id
      WHERE c.id = ? AND c.trainer_id = ?
    `;

    const [classResult] = await pool.query(classQuery, [classId, trainerId]);
    
    if (classResult.length === 0) {
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
      WHERE b.class_id = ? AND b.status != 'cancelled'
      ORDER BY u.last_name, u.first_name
    `;

    const [attendeesResult] = await pool.query(attendeesQuery, [classId]);

    res.json({
      class: classResult[0],
      attendees: attendeesResult
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

    // Begin transaction for consistent updates
    const client = await pool.getConnection();
    try {
      await client.query('START TRANSACTION');

      // Verify the class belongs to this trainer and load timings
      const verifyQuery = `
        SELECT b.id, c.class_date, c.start_time
        FROM bookings b
        JOIN classes c ON b.class_id = c.id
        WHERE b.id = ? AND c.id = ? AND c.trainer_id = ?
      `;
      const [verifyResult] = await client.query(verifyQuery, [bookingId, classId, trainerId]);
      if (verifyResult.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ message: 'Бронирование не найдено' });
      }

      // Enforce that attendance can be marked only when class has started
      const { class_date, start_time } = verifyResult[0];
      const startedResult = await client.query(
        `SELECT CASE 
           WHEN ? < CURDATE() THEN true
           WHEN ? = CURDATE() AND ? <= CURTIME() THEN true
           ELSE false
         END AS started`,
        [class_date, class_date, start_time]
      );
      if (!startedResult[0][0].started) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(409).json({ message: 'Отмечать посещаемость можно после начала занятия' });
      }

    // Get class duration for progress calculation
    const classQuery = `
      SELECT c.duration_minutes, b.user_id
      FROM classes c
      JOIN bookings b ON c.id = b.class_id
      WHERE b.id = ?
    `;
    
    const [classResult] = await client.query(classQuery, [bookingId]);
    if (classResult.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ message: 'Класс не найден' });
    }
    
    const { duration_minutes, user_id } = classResult[0];

    // Insert or update attendance record
    const attendanceQuery = `
      INSERT INTO attendance (booking_id, status, marked_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE 
        status = VALUES(status),
        marked_at = VALUES(marked_at)
    `;

    // Previous attendance status (for progress adjustments) and current booking status
    const [prevAttendanceRes] = await client.query('SELECT status FROM attendance WHERE booking_id = ?', [bookingId]);
    const prevAttendance = prevAttendanceRes[0]?.status || null;
    const [bookingStatusRes] = await client.query('SELECT status FROM bookings WHERE id = ? FOR UPDATE', [bookingId]);
    const prevBookingStatus = bookingStatusRes[0]?.status || 'booked';

    const [result] = await client.query(attendanceQuery, [bookingId, status]);
    
    // Update user progress if marked as attended
    // Sync booking.status with attendance and adjust user progress on transitions
    // Map: attended -> bookings.status='attended'; absent/late -> 'absent'/'booked' kept? Use 'absent' for absent, keep 'booked' for late
    if (status === 'attended') {
      await client.query('UPDATE bookings SET status = ? WHERE id = ?', ['attended', bookingId]);
      if (prevAttendance !== 'attended') {
        await client.query(
          `UPDATE users SET visits_count = visits_count + 1, minutes_practice = minutes_practice + ? WHERE id = ?`,
          [duration_minutes, user_id]
        );
      }
    } else if (status === 'absent') {
      await client.query('UPDATE bookings SET status = ? WHERE id = ?', ['absent', bookingId]);
      if (prevAttendance === 'attended') {
        // Revert progress if switching from attended to absent
        await client.query(
          `UPDATE users SET visits_count = GREATEST(visits_count - 1, 0), minutes_practice = GREATEST(minutes_practice - ?, 0) WHERE id = ?`,
          [duration_minutes, user_id]
        );
      }
    } else if (status === 'late') {
      // Keep booking as booked but record lateness
      await client.query('UPDATE bookings SET status = ? WHERE id = ?', ['booked', bookingId]);
      if (prevAttendance === 'attended') {
        // If switching from attended to late, revert progress
        await client.query(
          `UPDATE users SET visits_count = GREATEST(visits_count - 1, 0), minutes_practice = GREATEST(minutes_practice - ?, 0) WHERE id = ?`,
          [duration_minutes, user_id]
        );
      }
    }

    // Audit log for attendance change
    await client.query(
      `INSERT INTO audit_log (actor_id, actor_type, action, table_name, row_id, old_data, new_data, ip)
       VALUES (?, 'trainer', 'attendance', 'attendance', ?, JSON_OBJECT('status', ?), JSON_OBJECT('status', ?), IFNULL(?,'0.0.0.0'))`,
      [trainerId, bookingId, prevAttendance || null, status, req.ip || null]
    );

    await client.query('COMMIT');
    
    res.json({ message: 'Посещаемость отмечена', attendance: result[0] });
  } catch (error) {
    // Ensure rollback on unexpected errors inside inner try
    try { await client?.query('ROLLBACK'); } catch (_) {}
    client?.release?.();
    throw error;
  }
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ message: 'Ошибка отметки посещаемости' });
  }
});

export default router;
