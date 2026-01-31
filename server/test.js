// server/hash.ts
import * as bcrypt from 'bcrypt';

const password = 'admin123';
const saltRounds = 12;

bcrypt.hash(password, saltRounds).then(hash => {
  console.log('Hash for "admin123":', hash);
});