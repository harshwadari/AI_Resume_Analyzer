const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024  // 10 MB
    },
   
});

module.exports = upload;




/*

 fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true)  // ✅ accept
        } else {
            cb(new Error('Only PDF files are allowed'), false)  // ❌ reject
        }
    }
*/