const cloudinary = require('../middleware/cloudinary-config');

const uploadImage = async (filePaths, isPublic = true) => {
    const files = Array.isArray(filePaths) ? filePaths : [filePaths];
    try {
        const uploadPromises = files.map((filePath, index) => {
            return cloudinary.uploader.upload(filePath, {
                type: isPublic ? 'upload' : 'authenticated'
                })
            }
        );

        const uploadResults = await Promise.all(uploadPromises);
        
        return uploadResults.map(result => result.public_id);
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw new Error('Unable to upload image(s) to Cloudinary: ' + error.message);
    }
};



// Function to delete one or more images from Cloudinary
const deleteImage = async (publicIds, isPublic = true) => {
    const ids = Array.isArray(publicIds) ? publicIds : [publicIds];

    try {
        const deletePromises = ids.map((publicId) => {
            return cloudinary.uploader.destroy(publicId, {
                invalidate: true,
                resource_type: 'image',
                type: isPublic ? 'upload' : 'authenticated'
            });
        });

        const deleteResults = await Promise.all(deletePromises);
        
        // Check if all deletions were successful
        deleteResults.forEach((result, index) => {
            if (result.result !== 'ok') {
                console.warn(`Failed to delete image with publicId ${ids[index]}: ${result.result}`);
            } else {
                console.log(`Successfully deleted image with publicId ${ids[index]}.`);
            }
        });

        return deleteResults;
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        throw new Error('Unable to delete image(s) from Cloudinary: ' + error.message);
    }
};

module.exports = {
    uploadImage,
    deleteImage
};
