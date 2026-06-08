import mongoose from 'mongoose';

const paymentRequestSchema = new mongoose.Schema({
    applicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationPending',
        default: null
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        default: null
    },
    planRequested: {
        type: String,
        enum: ['FREE', 'PRO'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    transactionId: {
        type: String,
        required: true,
        trim: true
    },
    screenshotUrl: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    processedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// Ensure an application can only have one pending request at a time
paymentRequestSchema.index({ applicationId: 1, status: 1 });
paymentRequestSchema.index({ organizationId: 1, status: 1 });

const PaymentRequest = mongoose.model('PaymentRequest', paymentRequestSchema);

export default PaymentRequest;
