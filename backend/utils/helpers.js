/**
 * Generate a unique 6-digit alphanumeric code for group joining
 * @returns {string} 6-character code
 */
export const generateJoinCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';

    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return code;
};

/**
 * Calculate due date for a contribution based on group settings
 * @param {Date} startDate - Group start date
 * @param {number} cycleNumber - Current cycle number
 * @param {string} frequency - 'weekly' or 'monthly'
 * @returns {Date} Due date for the contribution
 */
export const calculateDueDate = (startDate, cycleNumber, frequency) => {
    const dueDate = new Date(startDate);

    if (frequency === 'weekly') {
        dueDate.setDate(dueDate.getDate() + (cycleNumber - 1) * 7);
    } else if (frequency === 'monthly') {
        dueDate.setMonth(dueDate.getMonth() + (cycleNumber - 1));
    }

    return dueDate;
};

/**
 * Check if a contribution is late
 * @param {Date} dueDate - Due date for contribution
 * @param {Date} submittedDate - Date contribution was submitted
 * @returns {boolean} True if late
 */
export const isContributionLate = (dueDate, submittedDate = new Date()) => {
    return submittedDate > dueDate;
};

/**
 * Validate receipt file
 * @param {Object} file - Multer file object
 * @returns {Object} { valid: boolean, error: string }
 */
export const validateReceiptFile = (file) => {
    if (!file) {
        return { valid: false, error: 'No file provided' };
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 5242880; // 5MB default

    if (!allowedMimeTypes.includes(file.mimetype)) {
        return {
            valid: false,
            error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed'
        };
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            error: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
        };
    }

    return { valid: true, error: null };
};

/**
 * Ensure directory exists, create if it doesn't
 * @param {string} dirPath - Directory path to ensure
 */
export const ensureDirectoryExists = async (dirPath) => {
    const fs = await import('fs');
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dirPath}`);
    }
};
