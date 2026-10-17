const express = require('express');
const router = express.Router();

const apiController = require('../controllers/apiController');
const authController = require('../controllers/authController');
const organizerController = require('../controllers/organizerController');
const superAdminController = require('../controllers/superAdminController');
const eventController = require('../controllers/eventController');
const venueController = require('../controllers/venueController');
const registrationController = require('../controllers/registrationController');
const eventAdminController = require('../controllers/eventAdminController');
const attendanceController = require('../controllers/attendanceController');
const notificationController = require('../controllers/notificationController');
const {
  requireAuth,
  requireRole,
  requireEventAccess,
  requireEventOperations,
  requireEventOperationsFromBody,
} = require('../middleware/auth');
const {
  apiRegisterRules,
  loginRules,
  organizerRequestRules,
  apiAssignRules,
  createEventRules,
  updateEventRules,
  scheduleRules,
  venueRules,
  apiAttendanceRules,
} = require('../middleware/validators');

router.get('/', apiController.index);
router.get('/health', apiController.healthCheck);

router.post('/auth/register', apiRegisterRules, authController.apiRegister);
router.post('/auth/login', loginRules, authController.apiLogin);
router.post('/auth/logout', requireAuth, authController.apiLogout);
router.get('/auth/me', requireAuth, authController.apiMe);

router.get('/users', requireRole('super_admin'), superAdminController.apiListUsers);

router.post(
  '/organizer-requests',
  requireRole('student'),
  organizerRequestRules,
  organizerController.apiCreateRequest
);
router.get('/organizer-requests', requireRole('super_admin'), superAdminController.apiListRequests);
router.put(
  '/organizer-requests/:id/approve',
  requireRole('super_admin'),
  superAdminController.apiApproveRequest
);
router.put(
  '/organizer-requests/:id/reject',
  requireRole('super_admin'),
  superAdminController.apiRejectRequest
);

router.get('/events', eventController.apiListEvents);
router.post('/events', requireRole('organizer'), createEventRules, eventController.apiCreateEvent);
router.get('/events/:id', eventController.apiGetEvent);
router.put('/events/:id', requireEventAccess, updateEventRules, eventController.apiUpdateEvent);
router.delete('/events/:id', requireEventAccess, eventController.apiDeleteEvent);

router.get('/events/:id/schedules', eventController.apiListSchedules);
router.post(
  '/events/:id/schedules',
  requireEventAccess,
  scheduleRules,
  eventController.apiAddSchedule
);
router.delete(
  '/events/:id/schedules/:scheduleId',
  requireEventAccess,
  eventController.apiRemoveSchedule
);

router.post('/events/:id/register', requireRole('student'), registrationController.apiRegister);
router.delete('/events/:id/register', requireRole('student'), registrationController.apiCancel);
router.get('/registrations/me', requireRole('student'), registrationController.apiMyRegistrations);

router.get(
  '/events/:id/participants',
  requireEventOperations,
  eventAdminController.apiParticipants
);
router.get(
  '/events/:id/attendance',
  requireEventOperations,
  attendanceController.apiListAttendance
);
router.post(
  '/attendance',
  requireEventOperationsFromBody,
  apiAttendanceRules,
  attendanceController.apiMark
);

router.post(
  '/events/:id/event-admin',
  requireRole('super_admin'),
  apiAssignRules,
  superAdminController.apiAssignEventAdmin
);
router.delete(
  '/events/:id/event-admin/:userId',
  requireRole('super_admin'),
  superAdminController.apiRemoveEventAdmin
);

router.get('/venues', requireAuth, venueController.apiListVenues);
router.get('/venues/:id', requireAuth, venueController.apiGetVenue);
router.post('/venues', requireRole('super_admin'), venueRules, venueController.apiCreateVenue);
router.put('/venues/:id', requireRole('super_admin'), venueRules, venueController.apiUpdateVenue);
router.delete('/venues/:id', requireRole('super_admin'), venueController.apiDeleteVenue);

router.get('/notifications', requireAuth, notificationController.apiList);
router.put('/notifications/:id/read', requireAuth, notificationController.apiMarkRead);

module.exports = router;