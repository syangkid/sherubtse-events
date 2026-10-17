let registered = false;

function registerListeners() {
  if (registered) return; 
  registered = true;

  require('./listeners/registrationListener').register();
  require('./listeners/attendanceListener').register();
  require('./listeners/organizerListener').register();

  console.log('Event listeners registered: RegistrationCreated, AttendanceRecorded, OrganizerRequestCreated');
}

module.exports = { registerListeners };