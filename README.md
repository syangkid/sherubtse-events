```text
sherubtse-events/
├── config/
│   ├── db.js
│   └── mailer.js
├── controllers/
│   ├── apiController.js
│   ├── attendanceController.js
│   ├── authController.js
│   ├── eventAdminController.js
│   ├── eventController.js
│   ├── homeController.js
│   ├── notificationController.js
│   ├── organizerController.js
│   ├── registrationController.js
│   ├── superAdminController.js
│   └── venueController.js
├── events/
│   ├── eventBus.js
│   ├── index.js
│   └── listeners/
│       ├── attendanceListener.js
│       ├── organizerListener.js
│       └── registrationListener.js
├── middleware/
│   ├── auth.js
│   ├── errorHandler.js
│   ├── notifications.js
│   └── validators.js
├── models/
│   ├── Attendance.js
│   ├── Event.js
│   ├── EventAdminAssignment.js
│   ├── Notification.js
│   ├── OrganizerRequest.js
│   ├── Registration.js
│   ├── Role.js
│   ├── Schedule.js
│   ├── Stats.js
│   ├── User.js
│   └── Venue.js
├── routes/
│   ├── api.js
│   └── index.js
├── utils/
│   ├── attendanceState.js
│   ├── formatDate.js
│   ├── httpError.js
│   ├── parseId.js
│   └── registrationState.js
├── views/
│   ├── partials/
│   │   ├── event-form.ejs
│   │   ├── flash-messages.ejs
│   │   ├── footer.ejs
│   │   ├── header.ejs
│   │   ├── nav-notifications.ejs
│   │   └── navbar.ejs
│   ├── errors/
│   │   ├── 403.ejs
│   │   ├── 404.ejs
│   │   └── 500.ejs
│   ├── superadmin/
│   │   ├── dashboard.ejs
│   │   ├── event-admin-assignments.ejs
│   │   ├── events.ejs
│   │   ├── organizer-requests.ejs
│   │   ├── users.ejs
│   │   ├── venue-form.ejs
│   │   └── venues.ejs
│   ├── organizer/
│   │   ├── create-event.ejs
│   │   ├── dashboard.ejs
│   │   ├── edit-event.ejs
│   │   └── my-events.ejs
│   ├── event-admin/
│   │   ├── dashboard.ejs
│   │   └── participants.ejs
│   ├── student/
│   │   ├── dashboard.ejs
│   │   ├── my-registrations.ejs
│   │   ├── organizer-request.ejs
│   │   └── profile.ejs
│   ├── events/
│   │   ├── details.ejs
│   │   └── index.ejs
│   ├── index.ejs
│   ├── login.ejs
│   ├── notifications.ejs
│   ├── signup-success.ejs
│   └── signup.ejs
├── public/
│   ├── css/
│   │   ├── dashboard.css
│   │   ├── responsive.css
│   │   ├── sherubtse.css
│   │   └── styles.css
│   └── images/
│       └── Sherubtse Home.PNG
│       └── sherubtse-logo.png
├── database/
│   ├── createTestDb.js
│   ├── createSuperAdmin.js
│   ├── run.js
│   ├── schema.sql
│   ├── seed.sql
│   └── testConnection.js
├── tests/
│   ├── helpers/
│   │   └── seedData.js
│   │   └── testApp.js
│   ├── attendance.test.js
│   ├── auth.test.js
│   ├── authorization.test.js
│   ├── errors.test.js
│   ├── event-driven.test.js
│   ├── events.test.js
│   ├── generatePostman.js
│   ├── organizer-requests.test.js
│   ├── registration.test.js
│   └── unit.test.js
├── node_modules
├── app.js
├── .env
├── .gitignore
├── nodemon.json
├── package-lock.json
├── package.json
└── README.md
```
