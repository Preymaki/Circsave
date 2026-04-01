import { body, param, validationResult } from 'express-validator';

/**
 * Middleware to check validation results
 */
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

/**
 * Validation rules for user registration
 */
export const registerValidation = [
    body('fullName')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    body('phoneNumber')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required'),
    body('address')
        .trim()
        .notEmpty()
        .withMessage('Address is required'),
    validate
];

/**
 * Validation rules for user login
 */
export const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    validate
];

/**
 * Validation rules for group creation
 */
export const createGroupValidation = [
    body('name')
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Group name must be between 3 and 100 characters'),
    body('contributionAmount')
        .isFloat({ min: 1 })
        .withMessage('Contribution amount must be a positive number'),
    body('contributionFrequency')
        .isIn(['daily', 'weekly', 'monthly'])
        .withMessage('Contribution frequency must be daily, weekly, or monthly'),
    body('contributionPeriodMonths')
        .isInt({ min: 1, max: 6 })
        .withMessage('Contribution period must be between 1 and 6 months'),
    body('maxMembers')
        .optional()
        .isInt({ min: 1, max: 10 })
        .withMessage('Max members must be between 1 and 10'),
    body('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid date')
        .custom((value) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (new Date(value) < today) {
                throw new Error('Start date cannot be in the past');
            }
            return true;
        }),
    body('latePaymentPenalty')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Late payment penalty must be a non-negative number'),
    validate
];

/**
 * Validation rules for joining a group
 */
export const joinGroupValidation = [
    body('joinCode')
        .trim()
        .isLength({ min: 6, max: 6 })
        .withMessage('Join code must be exactly 6 characters'),
    validate
];
