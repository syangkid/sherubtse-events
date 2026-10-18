const { pool } = require('../config/db');

let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch {
  bcrypt = require('bcryptjs'); 
}

async function main() {
  const [fullName, rawEmail] = process.argv.slice(2);
  const password = process.env.ADMIN_PASSWORD;

  if (!fullName || !rawEmail || !password) {
    console.error('Usage (Git Bash):');
    console.error('  ADMIN_PASSWORD=\'YourStrongPassword1\' node database/createSuperAdmin.js "Full Name" email@example.com');
    process.exitCode = 1;
    return;
  }

  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('That is not a valid email address.');
  if (fullName.trim().length < 2) throw new Error('Full name is too short.');
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password must be 8 to 72 characters with at least one letter and one number.');
  }

  const role = await pool.query(`SELECT id FROM roles WHERE role_name = 'super_admin'`);
  if (role.rowCount === 0) throw new Error('Roles are missing. Run the schema first.');

  const exists = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = $1', [email]);
  if (exists.rowCount > 0) throw new Error(`A user with ${email} already exists.`);

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role_id, is_verified)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [fullName.trim(), email, hash, role.rows[0].id]
  );
  console.log(`Super Admin created: ${email}`);
}

main()
  .catch((err) => {
    console.error('Could not create the Super Admin:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());