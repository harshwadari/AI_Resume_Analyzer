const dns = require('dns');
dns.setServers(['8.8.8.8','8.8.4.4']);
const path = require('path');
const backendDir = 'c:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/Backend';

const dotenv = require(path.join(backendDir, 'node_modules/dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const mongoose = require(path.join(backendDir, 'node_modules/mongoose'));
const User = require(path.join(backendDir, 'src/models/user.model'));
const { generateResetToken, hashToken } = require(path.join(backendDir, 'src/utils/otp.utils'));

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to DB');
  
  // Clean up existing test user if any
  await User.deleteOne({ email: 'testlocalreset@example.com' });
  
  // Create a verified local test user
  const user = await User.create({
    username: 'testlocal',
    email: 'testlocalreset@example.com',
    password: 'Password@123',
    authProvider: 'local',
    isVerified: true
  });
  console.log('Created local test user');

  // Trigger forgot password logic
  const rawToken = generateResetToken();
  user.resetPasswordToken = hashToken(rawToken);
  user.resetPasswordExpiry = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();
  console.log('Generated and saved reset token:', rawToken);

  // Validate resetting it
  const hashedToken = hashToken(rawToken);
  const userToReset = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpiry: { $gt: new Date() }
  });

  if (!userToReset) {
    console.error('FAILED: Reset token not found or expired!');
    process.exit(1);
  }

  userToReset.password = 'NewPassword@123';
  userToReset.resetPasswordToken = null;
  userToReset.resetPasswordExpiry = null;
  await userToReset.save();
  console.log('Password successfully reset in DB!');
  
  // Clean up
  await User.deleteOne({ email: 'testlocalreset@example.com' });
  console.log('Cleaned up test user');
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
