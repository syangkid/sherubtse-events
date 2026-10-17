function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateString(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function describeRegistration({ event, user, myStatus }) {
  const today = toDateString(new Date());
  const isUpcoming = toDateString(event.eventDate) >= today;
  const seatsLeft = Math.max(event.capacity - event.registeredCount, 0);
  const base = { seatsLeft, isUpcoming, canCancel: false };

  if (!user) {
    return { ...base, state: 'login', message: 'Log in with a student account to register.' };
  }
  if (user.role !== 'student') {
    return { ...base, state: 'not_student', message: 'Only student accounts can register for events.' };
  }
  if (myStatus === 'registered') {
    return {
      ...base,
      state: 'registered',
      canCancel: isUpcoming && event.status !== 'completed',
      message: 'You are registered for this event.',
    };
  }
  if (event.status === 'cancelled') {
    return { ...base, state: 'closed', message: 'This event has been cancelled.' };
  }
  if (event.status !== 'published') {
    return { ...base, state: 'closed', message: 'Registration is closed for this event.' };
  }
  if (!isUpcoming) {
    return { ...base, state: 'closed', message: 'This event has already taken place.' };
  }
  if (seatsLeft === 0) {
    return { ...base, state: 'full', message: 'This event is full.' };
  }
  return {
    ...base,
    state: 'open',
    message:
      myStatus === 'cancelled'
        ? 'You cancelled earlier. You can register again.'
        : 'Seats are available.',
  };
}

module.exports = { describeRegistration };