
DROP TABLE IF EXISTS notifications            CASCADE;
DROP TABLE IF EXISTS attendance               CASCADE;
DROP TABLE IF EXISTS registrations            CASCADE;
DROP TABLE IF EXISTS event_admin_assignments  CASCADE;
DROP TABLE IF EXISTS schedules                CASCADE;
DROP TABLE IF EXISTS events                   CASCADE;
DROP TABLE IF EXISTS organizer_requests       CASCADE;
DROP TABLE IF EXISTS venues                   CASCADE;
DROP TABLE IF EXISTS users                    CASCADE;
DROP TABLE IF EXISTS roles                    CASCADE;
DROP TABLE IF EXISTS "session"                CASCADE;
DROP FUNCTION IF EXISTS set_updated_at()      CASCADE;


CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TABLE roles (
  id         SERIAL PRIMARY KEY,
  role_name  VARCHAR(30) NOT NULL UNIQUE
             CHECK (role_name IN ('super_admin', 'organizer', 'student'))
);

INSERT INTO roles (role_name) VALUES ('super_admin'), ('organizer'), ('student');


CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  full_name      VARCHAR(120) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  student_id_no  VARCHAR(30)  UNIQUE,
  phone          VARCHAR(30),
  role_id        INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE UNIQUE INDEX users_email_unique ON users (LOWER(email));
CREATE INDEX users_role_id_idx ON users (role_id);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE venues (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(120) NOT NULL UNIQUE,
  location     VARCHAR(255) NOT NULL,
  capacity     INTEGER NOT NULL CHECK (capacity > 0),
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER venues_set_updated_at
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE organizer_requests (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE UNIQUE INDEX organizer_requests_one_pending_per_user
  ON organizer_requests (user_id) WHERE status = 'pending';
CREATE INDEX organizer_requests_status_idx ON organizer_requests (status);


CREATE TABLE events (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  event_date    DATE NOT NULL,
  capacity      INTEGER NOT NULL CHECK (capacity > 0),
  organizer_id  INTEGER NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
  venue_id      INTEGER          REFERENCES venues(id) ON DELETE RESTRICT,
  status        VARCHAR(20) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX events_organizer_id_idx ON events (organizer_id);
CREATE INDEX events_venue_id_idx     ON events (venue_id);
CREATE INDEX events_date_status_idx  ON events (event_date, status);

CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE schedules (
  id           SERIAL PRIMARY KEY,
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  start_time   TIMESTAMPTZ NOT NULL,
  end_time     TIMESTAMPTZ NOT NULL,
  description  VARCHAR(255) NOT NULL,
  CHECK (end_time > start_time)
);

CREATE INDEX schedules_event_id_idx ON schedules (event_id);


CREATE TABLE event_admin_assignments (
  id           SERIAL PRIMARY KEY,
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  assigned_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX event_admin_assignments_user_idx ON event_admin_assignments (user_id);


CREATE TABLE registrations (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  event_id       INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status         VARCHAR(20) NOT NULL DEFAULT 'registered'
                 CHECK (status IN ('registered', 'cancelled')),
  UNIQUE (user_id, event_id)   -- blocks duplicate registration in the database itself
);

CREATE INDEX registrations_event_id_idx ON registrations (event_id);


CREATE TABLE attendance (
  id                 SERIAL PRIMARY KEY,
  registration_id    INTEGER NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
  attendance_status  VARCHAR(20) NOT NULL
                     CHECK (attendance_status IN ('present', 'absent')),
  marked_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_by          INTEGER REFERENCES users(id) ON DELETE SET NULL
);


CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'unread'
              CHECK (status IN ('unread', 'read')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_user_status_idx ON notifications (user_id, status);


CREATE TABLE "session" (
  "sid"    VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  "sess"   JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);

CREATE INDEX "IDX_session_expire" ON "session" ("expire");