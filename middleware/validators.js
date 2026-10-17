const { body } = require('express-validator');

const accountFields = [
  body('full_name')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Full name must be between 2 and 120 characters.'),

  body('email')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Enter a valid email address.')
    .isLength({ max: 255 })
    .withMessage('Email is too long.'),

  body('student_id_no')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[A-Za-z0-9-]{3,30}$/)
    .withMessage('Student ID may contain letters, numbers and hyphens (3 to 30 characters).'),

  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[0-9+\-\s]{7,20}$/)
    .withMessage('Enter a valid phone number.'),

  body('password')
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be between 8 and 72 characters.')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain at least one letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number.'),
];

const registerRules = [
  ...accountFields,
  body('confirm_password')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.'),
];

const apiRegisterRules = accountFields;

const loginRules = [
  body('email')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Enter a valid email address.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

const organizerRequestRules = [
  body('reason')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Please explain your reason in 10 to 500 characters.'),
];

const assignRules = [
  body('event_id').isInt({ min: 1 }).withMessage('Choose an event.'),
  body('user_id').isInt({ min: 1 }).withMessage('Choose a user.'),
];

const apiAssignRules = [
  body('user_id').isInt({ min: 1 }).withMessage('user_id must be a positive integer.'),
];

const todayLocal = () => new Date().toLocaleDateString('en-CA');

const eventFields = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters.'),

  body('description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description can be at most 2000 characters.'),

  body('event_date')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Enter a valid date (YYYY-MM-DD).')
    .bail()
    .isISO8601({ strict: true })
    .withMessage('Enter a real calendar date.'),

  body('capacity')
    .isInt({ min: 1, max: 100000 })
    .withMessage('Capacity must be a whole number from 1 to 100000.')
    .toInt(),

  body('venue_id')
    .isInt({ min: 1 })
    .withMessage('Choose a venue.')
    .toInt(),
];

const createEventRules = [
  ...eventFields,
  body('event_date')
    .custom((value) => String(value) >= todayLocal())
    .withMessage('Event date cannot be in the past.'),
  body('status')
    .isIn(['draft', 'published'])
    .withMessage('Status must be draft or published.'),
];

const updateEventRules = [
  ...eventFields,
  body('status')
    .isIn(['draft', 'published', 'cancelled', 'completed'])
    .withMessage('Choose a valid status.'),
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const scheduleRules = [
  body('start_time').matches(TIME_PATTERN).withMessage('Enter a start time (HH:MM).'),
  body('end_time')
    .matches(TIME_PATTERN)
    .withMessage('Enter an end time (HH:MM).')
    .bail()
    .custom((value, { req }) => value > req.body.start_time)
    .withMessage('End time must be after the start time.'),
  body('description')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Description must be between 2 and 255 characters.'),
];

const venueRules = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Venue name must be between 2 and 120 characters.'),
  body('location')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Location must be between 2 and 255 characters.'),
  body('capacity')
    .isInt({ min: 1, max: 100000 })
    .withMessage('Capacity must be a whole number from 1 to 100000.')
    .toInt(),
  body('description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description can be at most 1000 characters.'),
];


const attendanceRules = [
  body('registration_id').isInt({ min: 1 }).withMessage('Choose a participant.'),
  body('status')
    .isIn(['present', 'absent'])
    .withMessage('Status must be present or absent.'),
];

const apiAttendanceRules = [
  body('event_id').isInt({ min: 1 }).withMessage('event_id must be a positive integer.'),
  ...attendanceRules,
];

module.exports = {
  registerRules,
  apiRegisterRules,
  loginRules,
  organizerRequestRules,
  assignRules,
  apiAssignRules,
  createEventRules,
  updateEventRules,
  scheduleRules,
  venueRules,
  attendanceRules,
  apiAttendanceRules,
};