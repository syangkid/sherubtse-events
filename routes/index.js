const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

const homeController = require('../controllers/homeController');
const authController = require('../controllers/authController');
const superAdminController = require('../controllers/superAdminController');
const organizerController = require('../controllers/organizerController');
const eventController = require('../controllers/eventController');
const venueController = require('../controllers/venueController');
const registrationController = require('../controllers/registrationController');
const eventAdminController = require('../controllers/eventAdminController');
const attendanceController = require('../controllers/attendanceController');
const {
  requireAuth,
  requireRole,
  requireEventAccess,
  requireEventOperations,
  requireEventAdminAssignment,
  redirectIfAuthenticated,
} = require('../middleware/auth');

const {
  registerRules,
  loginRules,
  organizerRequestRules,
  assignRules,
  createEventRules,
  updateEventRules,
  scheduleRules,
  venueRules,
  attendanceRules,
} = require('../middleware/validators');


router.get('/', homeController.showHome);
router.get('/events', homeController.showEvents);
router.get('/events/:id', homeController.showEventDetails);

router.get('/signup', redirectIfAuthenticated, authController.showSignup);
router.post('/signup', redirectIfAuthenticated, registerRules, authController.signup);
router.get('/signup-success', authController.showSignupSuccess);

router.get('/login', redirectIfAuthenticated, authController.showLogin);
router.post('/login', redirectIfAuthenticated, loginRules, authController.login);

router.get('/logout', authController.logout);

router.use('/superadmin', requireAuth, requireRole('super_admin'));

router.get('/superadmin/dashboard', superAdminController.showDashboard);
router.get('/superadmin/users', superAdminController.showUsers);

router.get('/superadmin/organizer-requests', superAdminController.showOrganizerRequests);
router.post('/superadmin/organizer-requests/:id/approve', superAdminController.approveRequest);
router.post('/superadmin/organizer-requests/:id/reject', superAdminController.rejectRequest);

router.get('/superadmin/event-admin-assignments', superAdminController.showAssignments);
router.post(
  '/superadmin/event-admin-assignments',
  assignRules,
  superAdminController.assignEventAdminWeb
);
router.post(
  '/superadmin/event-admin-assignments/:id/remove',
  superAdminController.removeAssignmentWeb
);

router.get('/superadmin/events', eventController.showAllEvents);

router.get('/superadmin/venues', venueController.showVenues);
router.get('/superadmin/venues/new', venueController.showNewForm);
router.post('/superadmin/venues', venueRules, venueController.createVenueWeb);
router.get('/superadmin/venues/:id/edit', venueController.showEditForm);
router.post('/superadmin/venues/:id/edit', venueRules, venueController.updateVenueWeb);
router.post('/superadmin/venues/:id/delete', venueController.deleteVenueWeb);

router.get(
  '/organizer/dashboard',
  requireAuth,
  requireRole('organizer'),
  organizerController.showDashboard
);
router.get(
  '/organizer/my-events',
  requireAuth,
  requireRole('organizer'),
  eventController.showMyEvents
);
router.get(
  '/organizer/create-event',
  requireAuth,
  requireRole('organizer'),
  eventController.showCreateForm
);
router.post(
  '/organizer/create-event',
  requireAuth,
  requireRole('organizer'),
  createEventRules,
  eventController.createEventWeb
);

router.get('/manage/events/:id/edit', requireEventAccess, eventController.showEditForm);
router.post(
  '/manage/events/:id/edit',
  requireEventAccess,
  updateEventRules,
  eventController.updateEventWeb
);
router.post('/manage/events/:id/delete', requireEventAccess, eventController.deleteEventWeb);
router.post(
  '/manage/events/:id/schedules',
  requireEventAccess,
  scheduleRules,
  eventController.addScheduleWeb
);
router.post(
  '/manage/events/:id/schedules/:scheduleId/delete',
  requireEventAccess,
  eventController.removeScheduleWeb
);

router.get(
  '/student/dashboard',
  requireAuth,
  requireRole('student'),
  registrationController.showStudentDashboard
);
router.get(
  '/student/my-registrations',
  requireAuth,
  requireRole('student'),
  registrationController.showMyRegistrations
);
router.get(
  '/student/profile',
  requireAuth,
  requireRole('student'),
  homeController.showProfile
);

router.post(
  '/events/:id/register',
  requireAuth,
  requireRole('student'),
  registrationController.registerWeb
);
router.post(
  '/events/:id/cancel',
  requireAuth,
  requireRole('student'),
  registrationController.cancelWeb
);

router.get(
  '/student/organizer-request',
  requireAuth,
  requireRole('student'),
  organizerController.showRequestForm
);
router.post(
  '/student/organizer-request',
  requireAuth,
  requireRole('student'),
  organizerRequestRules,
  organizerController.submitRequest
);

router.get(
  '/event-admin/dashboard',
  requireAuth,
  requireEventAdminAssignment,
  eventAdminController.showDashboard
);

router.get(
  '/manage/events/:id/participants',
  requireEventOperations,
  eventAdminController.showParticipants
);
router.post(
  '/manage/events/:id/attendance',
  requireEventOperations,
  attendanceRules,
  attendanceController.markWeb
);

router.get('/notifications', requireAuth, notificationController.showNotifications);
router.post('/notifications/read-all', requireAuth, notificationController.markAllReadWeb);
router.post('/notifications/:id/read', requireAuth, notificationController.markReadWeb);

module.exports = router;
