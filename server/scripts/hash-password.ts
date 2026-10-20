import { hashPassword } from '../security/auth.ts';

const password = process.argv[2];
if (!password) {
  console.log('Usage: npm run hash-password <password>');
  process.exit(1);
}

const hash = hashPassword(password);
console.log('\n--- X Monitor Password Hash Generator ---');
console.log('Password Hash:');
console.log(hash);
console.log('\nPut this into your .env file as:');
console.log(`ADMIN_PASSWORD_HASH="${hash}"\n`);
