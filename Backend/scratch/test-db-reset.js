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
  const user = await User.findOne({ email: 'harshwadari@gmail.com' });
  if (!user) {
    console.log('User not found');
  } else {
    console.log('User details:', JSON.stringify({
      username: user.username,
      email: user.email,
      isVerified: user.isVerified,
      authProvider: user.authProvider,
      hasPassword: !!user.password,
      resetPasswordToken: user.resetPasswordToken,
      resetPasswordExpiry: user.resetPasswordExpiry
    }, null, 2));
  }
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
