import Joi from "joi";

export const validateOrganization = (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string().trim().min(2).max(100).required(),
        ownerName: Joi.string().trim().min(2).max(100).required(),
        ownerEmail: Joi.string().email().required(),
        address: Joi.string().trim().min(5).max(250).required(),
        designation: Joi.string().trim().max(100).optional().allow(""),
        contactNumber: Joi.string().trim().max(20).optional().allow(""),
        website: Joi.string().uri().optional().allow(""),
    }).unknown(true);

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message, code: "VALIDATION_ERROR" });
    next();
};

export const validateApplyOrg = (req, res, next) => {
    const schema = Joi.object({
        institute_name: Joi.string().trim().min(2).max(100).required(),
        owner_name: Joi.string().trim().min(2).max(100).required(),
        owner_email: Joi.string().email().required(),
        address: Joi.string().trim().min(5).max(250).required(),
        designation: Joi.string().trim().max(100).optional().allow(""),
        phone: Joi.string().trim().max(20).required(),
        website: Joi.string().trim().max(200).optional().allow(""),
        logo_base64: Joi.string().optional().allow(""),
        planRequested: Joi.string().valid('FREE', 'PRO').optional(),
        transactionId: Joi.string().trim().max(100).optional().allow(""),
        paymentScreenshot_base64: Joi.string().optional().allow("")
    }).unknown(true);

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message, code: "VALIDATION_ERROR" });
    next();
};

export const validateFaculty = (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string().trim().min(2).max(100).required(),
        email: Joi.string().email().required(),
        department: Joi.string().trim().max(100).optional().allow(""),
        qualification: Joi.string().trim().max(100).optional().allow(""),
        subject: Joi.string().trim().max(100).optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message, code: "VALIDATION_ERROR" });
    next();
};

export const validateClassroom = (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string().trim().min(2).max(100).required(),
        subject: Joi.string().trim().min(2).max(100).required(),
        description: Joi.string().trim().max(500).optional().allow(""),
        subjectSlug: Joi.string().trim().max(100).optional().allow(""),
        settings: Joi.object({
            allowJoinRequests: Joi.boolean().optional(),
            maxStudents: Joi.number().min(1).max(10000).optional(),
        }).optional(),
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message, code: "VALIDATION_ERROR" });
    next();
};

export const validateJoinCode = (req, res, next) => {
    const schema = Joi.object({
        classCode: Joi.string().pattern(/^[A-Z]{4}[0-9]{6}$/).required().messages({
            "string.pattern.base": '"classCode" must be exactly 4 uppercase letters followed by 6 numbers (e.g., ABCD123456)',
        }),
        requestMessage: Joi.string().trim().max(500).optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message, code: "VALIDATION_ERROR" });
    next();
};

export const validateOrgCode = (req, res, next) => {
    const schema = Joi.object({
        organizationCode: Joi.string().trim().alphanum().min(3).max(50).required(),
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message, code: "VALIDATION_ERROR" });
    next();
};

// Validation for the new dual-code verify endpoint
export const validateVerifyCode = (req, res, next) => {
    const schema = Joi.object({
        code: Joi.string().trim().alphanum().min(3).max(50).uppercase().required().messages({
            "string.min": "Code must be at least 3 characters",
            "string.max": "Code must not exceed 50 characters",
            "string.alphanum": "Code must contain only letters and numbers",
            "any.required": "Code is required",
        }),
        type: Joi.string().valid("faculty", "student").required().messages({
            "any.only": "Type must be 'faculty' or 'student'",
            "any.required": "Type is required",
        }),
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message, code: "VALIDATION_ERROR" });
    next();
};

export const validateOrganizationAnnouncement = (req, res, next) => {
    const schema = Joi.object({
        title: Joi.string().trim().min(3).max(200).required(),
        content: Joi.string().required(), // HTML content
        type: Joi.string().valid("announcement", "notice", "event", "holiday", "emergency").optional(),
        target_type: Joi.string().valid("specific", "all").required(),
        target_classrooms: Joi.when('target_type', {
            is: 'specific',
            then: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
            otherwise: Joi.forbidden() // Must not pass classrooms if target is 'all'
        }),
        status: Joi.string().valid("draft", "scheduled", "published").optional(),
        expires_at: Joi.date().iso().greater('now').optional().allow(null),
        attachment_base64: Joi.string().optional().allow(""),
        attachment_name: Joi.string().trim().max(255).optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message, code: "VALIDATION_ERROR" });
    next();
};
