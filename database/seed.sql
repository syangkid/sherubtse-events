CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO users
(
    full_name,
    email,
    password_hash,
    student_id_no,
    phone,
    role_id,
    is_verified
)

SELECT
    v.full_name,
    v.email,
    crypt(v.password, gen_salt('bf', 10)),
    v.student_id_no,
    v.phone,
    r.id,
    TRUE

FROM
(
    VALUES

    (
        'Sonam Yangki',
        'yangki01@gmail.com',
        'Demo@12345',
        NULL,
        '07200001',
        'super_admin'
    ),

    (
        'Sangay Rai',
        'srai444@gmail.com',
        'Demo@12345',
        '07200044',
        '17444444',
        'organizer'
    ),

    (
        'Tobden Dorji',
        'otdorji55@gmail.com',
        'Demo@12345',
        '07200052',
        '17555555',
        'organizer'
    ),

    (
        'Tshering Nidup',
        'tnidp66@gmail.com',
        'Demo@12345',
        '07200096',
        '17666666',
        'student'
    ),

    (
        'Tshering Dorji',
        'tdorji77@gmail.com',
        'Demo@12345',
        '07200008',
        '17777777',
        'student'
    ),

    (
        'Dorji Choden',
        'dcden92@gmail.com',
        'Demo@12345',
        '07200067',
        '17888888',
        'student'
    ),

    (
        'Wangchuk Lhamo',
        'wlham@gmail.com',
        'Demo@12345',
        '07200005',
        '17999999',
        'student'
    ),

    (
        'Choki Dorji',
        'cdorjj64@gmail.com',
        'Demo@12345',
        '07200074',
        '17000074',
        'student'
    ),

    (
        'Karma Wangmo',
        'karma.wangmo@gmail.com',
        'Demo@12345',
        '07200080',
        '17000080',
        'student'
    )

) AS v
(
    full_name,
    email,
    password,
    student_id_no,
    phone,
    role_name
)

JOIN roles r
    ON r.role_name = v.role_name;



INSERT INTO venues (name, location, capacity, description) VALUES
  ('MPH',             'Main campus (demo data)', 800, 'Large hall for big gatherings and events.'),
  ('New LT',          'Main campus (demo data)', 100, 'Lecture theatre for talks and classes.'),
  ('Conference Hall', 'Main campus (demo data)',  60, 'Hall for meetings and conferences.'),
  ('Auditorium',      'Main campus (demo data)', 700, 'Large hall for ceremonies and performances.'),
  ('Seminar Hall',    'Main campus (demo data)',  30, 'Small hall for seminars and workshops.'),
  ('ITLT',            'Main campus (demo data)',  80, 'Lecture theatre for technical events.');



INSERT INTO events (title, description, event_date, capacity, organizer_id, venue_id, status)
SELECT v.title, v.description, CURRENT_DATE + v.days_from_now, v.capacity,
       u.id, ve.id, v.status
FROM (VALUES
  ('Hackathon 2026',
   'A 24-hour coding challenge for student teams.',
   14, 40, 'organizer1@demo.test', 'ITLT', 'published'),
  ('Cultural Night',
   'An evening of music, dance, and performances.',
   30, 300, 'organizer2@demo.test', 'Auditorium', 'published'),
  ('Inter-Class Football Tournament',
   'Knockout football tournament between classes.',
   7, 100, 'organizer1@demo.test', 'MPH', 'published'),
  ('Career Talk Series',
   'Guest speakers talk about careers after graduation.',
   -10, 80, 'organizer2@demo.test', 'New LT', 'completed'),
  ('Photography Workshop',
   'Hands-on introduction to photography (not yet published).',
   45, 25, 'organizer1@demo.test', 'Seminar Hall', 'draft')
) AS v(title, description, days_from_now, capacity, organizer_email, venue_name, status)
JOIN users  u  ON u.email  = v.organizer_email
JOIN venues ve ON ve.name  = v.venue_name;


INSERT INTO schedules
(
    event_id,
    start_time,
    end_time,
    description
)

SELECT
    e.id,
    e.event_date + v.start_t::time,
    e.event_date + v.end_t::time,
    v.description

FROM
(
    VALUES

    (
        'Sherubtse Innovation Hackathon',
        '09:00',
        '10:00',
        'Opening and team formation'
    ),

    (
        'Sherubtse Innovation Hackathon',
        '10:00',
        '17:00',
        'Coding and development session'
    ),

    (
        'Sherubtse Innovation Hackathon',
        '17:00',
        '18:30',
        'Project demonstrations and judging'
    ),

    (
        'Sherubtse Cultural Night',
        '17:30',
        '18:00',
        'Guest arrival and seating'
    ),

    (
        'Sherubtse Cultural Night',
        '18:00',
        '21:00',
        'Cultural performances'
    ),

    (
        'Inter-Class Football Tournament',
        '09:00',
        '16:00',
        'Matches and final'
    ),

    (
        'Career Talk Series',
        '10:00',
        '11:00',
        'Career guidance session'
    ),

    (
        'Career Talk Series',
        '11:15',
        '12:15',
        'Professional development session'
    )

) AS v
(
    title,
    start_t,
    end_t,
    description
)

JOIN events e
    ON e.title = v.title;



INSERT INTO registrations
(
    user_id,
    event_id,
    status
)

SELECT
    u.id,
    e.id,
    v.status

FROM
(
    VALUES

    (
        'tnidp66@gmail.com',
        'Sherubtse Innovation Hackathon',
        'registered'
    ),

    (
        'tdorji77@gmail.com',
        'Sherubtse Innovation Hackathon',
        'registered'
    ),

    (
        'dcden92@gmail.com',
        'Sherubtse Innovation Hackathon',
        'registered'
    ),

    (
        'karma.wangmo@gmail.com',
        'Sherubtse Innovation Hackathon',
        'cancelled'
    ),

    (
        'tnidp66@gmail.com',
        'Sherubtse Cultural Night',
        'registered'
    ),

    (
        'wlham@gmail.com',
        'Sherubtse Cultural Night',
        'registered'
    ),

    (
        'tdorji77@gmail.com',
        'Inter-Class Football Tournament',
        'registered'
    ),

    (
        'cdorjj64@gmail.com',
        'Inter-Class Football Tournament',
        'registered'
    ),

    (
        'tnidp66@gmail.com',
        'Career Talk Series',
        'registered'
    ),

    (
        'tdorji77@gmail.com',
        'Career Talk Series',
        'registered'
    ),

    (
        'dcden92@gmail.com',
        'Career Talk Series',
        'registered'
    ),

    (
        'wlham@gmail.com',
        'Career Talk Series',
        'registered'
    )

) AS v
(
    email,
    title,
    status
)

JOIN users u
    ON u.email = v.email

JOIN events e
    ON e.title = v.title;



INSERT INTO attendance
(
    registration_id,
    attendance_status,
    marked_by
)

SELECT
    r.id,
    v.attendance_status,
    o.id

FROM
(
    VALUES

    (
        'tnidp66@gmail.com',
        'present'
    ),

    (
        'tdorji77@gmail.com',
        'present'
    ),

    (
        'dcden92@gmail.com',
        'absent'
    ),

    (
        'wlham@gmail.com',
        'present'
    )

) AS v
(
    email,
    attendance_status
)

JOIN users u
    ON u.email = v.email

JOIN events e
    ON e.title = 'Career Talk Series'

JOIN registrations r
    ON r.user_id = u.id
    AND r.event_id = e.id

JOIN users o
    ON o.email = 'otdorji55@gmail.com';


INSERT INTO organizer_requests
(
    user_id,
    reason,
    status,
    reviewed_by,
    reviewed_at
)

SELECT
    u.id,
    v.reason,
    v.status,
    sa.id,

    CASE
        WHEN v.status = 'pending'
            THEN NULL
        ELSE NOW() - INTERVAL '30 days'
    END

FROM
(
    VALUES

    (
        'srai444@gmail.com',
        'I lead student technical activities and would like to organize technology-focused events.',
        'approved'
    ),

    (
        'otdorji55@gmail.com',
        'I help coordinate student cultural activities and would like to organize college events.',
        'approved'
    ),

    (
        'cdorjj64@gmail.com',
        'I would like to organize inter-department student activities and quiz events.',
        'pending'
    ),

    (
        'karma.wangmo@gmail.com',
        'I would like to organize student events and activities.',
        'rejected'
    )

) AS v
(
    email,
    reason,
    status
)

JOIN users u
    ON u.email = v.email

CROSS JOIN
(
    SELECT id
    FROM users
    WHERE email = 'yangki01@gmail.com'
) AS sa;



UPDATE organizer_requests
SET reviewed_by = NULL,
    reviewed_at = NULL
WHERE status = 'pending';



INSERT INTO event_admin_assignments
(
    event_id,
    user_id,
    assigned_by
)

SELECT
    e.id,
    u.id,
    sa.id

FROM
(
    VALUES

    (
        'Sherubtse Innovation Hackathon',
        'tnidp66@gmail.com'
    ),

    (
        'Sherubtse Cultural Night',
        'tdorji77@gmail.com'
    )

) AS v
(
    title,
    email
)

JOIN events e
    ON e.title = v.title

JOIN users u
    ON u.email = v.email

JOIN users sa
    ON sa.email = 'yangki01@gmail.com';



INSERT INTO notifications
(
    user_id,
    message,
    status
)

SELECT
    u.id,
    v.message,
    v.status

FROM
(
    VALUES

    (
        'tnidp66@gmail.com',
        'You are successfully registered for the Sherubtse Innovation Hackathon.',
        'unread'
    ),

    (
        'tdorji77@gmail.com',
        'You are successfully registered for the Sherubtse Innovation Hackathon.',
        'read'
    ),

    (
        'srai444@gmail.com',
        'Your organizer request was approved by the Super Admin.',
        'read'
    ),

    (
        'yangki01@gmail.com',
        'New organizer request from Choki Dorji.',
        'unread'
    )

) AS v
(
    email,
    message,
    status
)

JOIN users u
    ON u.email = v.email;