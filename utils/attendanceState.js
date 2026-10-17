function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateString(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function attendanceWindow(event) {
  if (!['published', 'completed'].includes(event.status)) {
    return {
      open: false,
      message: 'Attendance can be marked only for published or completed events.',
    };
  }
  if (toDateString(event.eventDate) > toDateString(new Date())) {
    return {
      open: false,
      message: 'Attendance can be marked only on or after the event date.',
    };
  }
  return { open: true, message: '' };
}

function summarize(participants) {
  const active = participants.filter((p) => p.status === 'registered');
  const present = active.filter((p) => p.attendanceStatus === 'present').length;
  const absent = active.filter((p) => p.attendanceStatus === 'absent').length;
  return {
    registered: active.length,
    present,
    absent,
    notMarked: active.length - present - absent,
    cancelled: participants.length - active.length,
  };
}

module.exports = { attendanceWindow, summarize };