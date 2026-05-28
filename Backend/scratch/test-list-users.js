const dns = require('dns');
dns.setServers(['8.8.8.8','8.8.4.4']);
const path = require('path');
const backendDir = 'c:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/Backend';

const dotenv = require(path.join(backendDir, 'node_modules/dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const mongoose = require(path.join(backendDir, 'node_modules/mongoose'));
const User = require(path.join(backendDir, 'src/models/user.model'));

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to DB');
  const users = await User.find({});
  console.log('Users:');
  users.forEach(u => {
    console.log({
      email: u.email,
      username: u.username,
      isVerified: u.isVerified,
      authProvider: u.authProvider,
      hasPassword: !!u.password
    });
  });
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
