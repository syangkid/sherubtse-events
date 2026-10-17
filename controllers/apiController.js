const { query } = require('../config/db');

async function healthCheck(req, res, next) {
  try {
    const result = await query('SELECT NOW() AS server_time');
    res.status(200).json({
      success: true,
      message: 'Sherubtse College Event Management System API is running',
      data: {
        server: 'ok',
        database: 'ok',
        databaseTime: result.rows[0].server_time,
      },
    });
  } catch (err) {
    next(err);
  }
}

const ENDPOINTS = [
  'GET    /api/health                          public',
  'POST   /api/auth/register                   public',
  'POST   /api/auth/login                      public',
  'POST   /api/auth/logout                     logged in',
  'GET    /api/auth/me                         logged in',
  'GET    /api/users                           super_admin',
  'GET    /api/events                          public (?search= ?when= ?mine=true)',
  'POST   /api/events                          organizer',
  'GET    /api/events/:id                      public (drafts: managers only)',
  'PUT    /api/events/:id                      super_admin or owner',
  'DELETE /api/events/:id                      super_admin or owner',
  'GET    /api/events/:id/schedules            public (drafts: managers only)',
  'POST   /api/events/:id/schedules            super_admin or owner',
  'DELETE /api/events/:id/schedules/:scheduleId super_admin or owner',
  'POST   /api/events/:id/register             student',
  'DELETE /api/events/:id/register             student',
  'GET    /api/registrations/me                student',
  'GET    /api/events/:id/participants         super_admin, owner, or assigned Event Admin',
  'GET    /api/events/:id/attendance           super_admin, owner, or assigned Event Admin',
  'POST   /api/attendance                      super_admin, owner, or assigned Event Admin',
  'POST   /api/organizer-requests              student',
  'GET    /api/organizer-requests              super_admin',
  'PUT    /api/organizer-requests/:id/approve  super_admin',
  'PUT    /api/organizer-requests/:id/reject   super_admin',
  'POST   /api/events/:id/event-admin          super_admin',
  'DELETE /api/events/:id/event-admin/:userId  super_admin',
  'GET    /api/venues                          logged in',
  'GET    /api/venues/:id                      logged in',
  'POST   /api/venues                          super_admin',
  'PUT    /api/venues/:id                      super_admin',
  'DELETE /api/venues/:id                      super_admin',
  'GET    /api/notifications                   logged in (own)',
  'PUT    /api/notifications/:id/read          logged in (own)',
];

function index(req, res) {
  res.status(200).json({
    success: true,
    message: 'Sherubtse College Event Management System REST API',
    data: { endpoints: ENDPOINTS },
  });
}

module.exports = { healthCheck, index };