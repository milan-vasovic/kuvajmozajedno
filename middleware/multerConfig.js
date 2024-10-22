const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Konfigurišite Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Postavite CloudinaryStorage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const type = (req.body.type === 'protected' || req.body.type === 'private') ? 'authenticated' :'upload';
        return {
            folder: 'uploads', // Folder in Cloudinary
            allowed_formats: ['jpg', 'png'], // Allowed formats
            type: type // Conditional type
        };
    },
});

// Multer middleware for handling file uploads
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "image/png" || file.mimetype === "image/jpg" || file.mimetype === "image/jpeg") {
            cb(null, true);
        } else {
            cb(null, false);
        }
    }
}).array('images', 5);

module.exports = upload;
