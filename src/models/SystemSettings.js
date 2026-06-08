import mongoose from "mongoose";

const systemSettingsSchema = new mongoose.Schema({
    maintenanceMode: { type: Boolean, default: false },
    disableRegistrations: { type: Boolean, default: false },
    globalLock: { type: Boolean, default: false },
    aiFeatures: { type: Boolean, default: true },
    notesSystem: { type: Boolean, default: true },
    chatSystem: { type: Boolean, default: true }
}, { timestamps: true });

const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);

export default SystemSettings;
