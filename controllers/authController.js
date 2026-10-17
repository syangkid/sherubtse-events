const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');

const User = require('../models/User');
const Role = require('../models/Role');
const httpError = require('../utils/httpError');
const { homePathForRole } = require('../middleware/auth');

const SALT_ROUNDS = 10;

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', SALT_ROUNDS);

function regenerateSession(req) {
  return new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve()))
  );
}

function saveSession(req) {
  return new Promise((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );
}

function destroySession(req) {
  return new Promise((resolve, reject) =>
    req.session.destroy((err) => (err ? reject(err) : resolve()))
  );
}

async function createAccount(body) {
  if (await User.emailExists(body.email)) {
    throw httpError(409, 'An account with this email already exists.', 'email');
  }
  if (body.student_id_no && (await User.studentIdExists(body.student_id_no))) {
    throw httpError(409, 'This student ID is already registered.', 'student_id_no');
  }

  const studentRole = await Role.findByName('student');
  const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

  try {
    return await User.create({
      fullName: body.full_name,
      email: body.email,
      passwordHash,
      studentIdNo: body.student_id_no,
      phone: body.phone,
      roleId: studentRole.id,
    });
  } catch (err) {
    if (err.code === '23505') {
      throw httpError(409, 'An account with these details already exists.');
    }
    throw err;
  }
}

async function authenticate(email, password) {
  const credentials = await User.findCredentialsByEmail(email);
  const hash = credentials ? credentials.password_hash : DUMMY_HASH;
  const passwordOk = await bcrypt.compare(password, hash);

  if (!credentials || !passwordOk) {
    throw httpError(401, 'Invalid email or password.');
  }
  return User.findById(credentials.id);
}

async function startSession(req, userId) {
  await regenerateSession(req);
  req.session.userId = userId;
}

function errorList(errors) {
  return errors.array().map((e) => ({ field: e.path, message: e.msg }));
}

function showSignup(req, res) {
  res.render('signup', { title: 'Register', errors: {}, old: {} });
}

async function signup(req, res, next) {
  const result = validationResult(req);
  const old = {
    full_name: req.body.full_name,
    email: req.body.email,
    student_id_no: req.body.student_id_no,
    phone: req.body.phone,
  };

  if (!result.isEmpty()) {
    return res.status(400).render('signup', {
      title: 'Register',
      errors: result.mapped(),
      old,
    });
  }

  try {
    await createAccount(req.body);
    req.session.flash = { type: 'success', message: 'Account created. You can now log in.' };
    res.redirect('/signup-success');
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).render('signup', {
        title: 'Register',
        errors: err.field ? { [err.field]: { msg: err.message } } : {},
        old,
        flash: err.field ? null : { type: 'error', message: err.message },
      });
    }
    next(err);
  }
}

function showSignupSuccess(req, res) {
  res.render('signup-success', { title: 'Registration complete' });
}

function showLogin(req, res) {
  res.render('login', { title: 'Login', errors: {}, old: {} });
}

async function login(req, res, next) {
  const result = validationResult(req);
  const old = { email: req.body.email };

  if (!result.isEmpty()) {
    return res.status(400).render('login', {
      title: 'Login',
      errors: result.mapped(),
      old,
    });
  }

  try {
    const user = await authenticate(req.body.email, req.body.password);
    await startSession(req, user.id);
    req.session.flash = { type: 'success', message: `Welcome, ${user.fullName}.` };
    await saveSession(req); // make sure the session is stored before redirecting
    res.redirect(homePathForRole(user.role));
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).render('login', {
        title: 'Login',
        errors: {},
        old,
        flash: { type: 'error', message: err.message },
      });
    }
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await regenerateSession(req);
    req.session.flash = { type: 'info', message: 'You have been logged out.' };
    await saveSession(req);
    res.redirect('/login');
  } catch (err) {
    next(err);
  }
}

async function apiRegister(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorList(result),
    });
  }

  try {
    const user = await createAccount(req.body);
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user },
    });
  } catch (err) {
    next(err); 
  }
}

async function apiLogin(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorList(result),
    });
  }

  try {
    const user = await authenticate(req.body.email, req.body.password);
    await startSession(req, user.id);
    await saveSession(req);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

async function apiLogout(req, res, next) {
  try {
    await destroySession(req);
    res.clearCookie('connect.sid');
    res.status(200).json({ success: true, message: 'Logged out successfully', data: {} });
  } catch (err) {
    next(err);
  }
}

function apiMe(req, res) {
  res.status(200).json({
    success: true,
    message: 'Current user',
    data: { user: req.user },
  });
}

module.exports = {
  showSignup,
  signup,
  showSignupSuccess,
  showLogin,
  login,
  logout,
  apiRegister,
  apiLogin,
  apiLogout,
  apiMe,
};