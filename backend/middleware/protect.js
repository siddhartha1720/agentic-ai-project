import mongoose from "mongoose";

const customApiConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    provider: {
      type: String,
      enum: ["erpnext", "generic_rest"],
      default: "erpnext",
    },
    baseUrl: { type: String, required: true, trim: true },
    auth: {
      type: { type: String, enum: ["frappe_token"], required: true },
      secretEncrypted: { type: String, required: true, select: false },
    },
    status: {
      type: String,
      enum: ["connected", "error", "revoked"],
      default: "connected",
    },
    capabilities: { type: [String], default: ["employee:read"] },
    metadata: {
      siteName: { type: String, default: "" },
      connectedUser: { type: String, default: "" },
    },
    lastValidatedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

customApiConnectionSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model("CustomApiConnection", customApiConnectionSchema);