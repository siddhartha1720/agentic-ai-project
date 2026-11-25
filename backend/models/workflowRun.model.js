
import mongoose from "mongoose";

const workflowRunSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "running",
        "approval_required",
        "completed",
        "rejected",
        "failed",
      ],
      default: "running",
    },

    currentNodeId: {
      type: String,
      default: null,
    },

    currentOutput: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
// Workflow definition snapshot for safe resumption
workflowSnapshot: {
  type: mongoose.Schema.Types.Mixed,
  default: null,
},

// Number of steps already executed
resumeState: {
  type: mongoose.Schema.Types.Mixed,
  default: null,
},

// Approval tracking

    // Approval tracking
    approval: {
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: null,
      },

      // Exact action the user is being asked to approve
      toolId: {
        type: String,
        default: null,
      },

      // Validated action arguments; never store auth tokens
      args: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },

      // SHA-256 fingerprint of the canonical action payload
      actionHash: {
        type: String,
        default: null,
      },

      requestedAt: {
        type: Date,
        default: null,
      },

      decidedAt: {
        type: Date,
        default: null,
      },
    },

    // Execution tracking for approved write actions
    actionExecution: {
      status: {
        type: String,
        enum: ["pending", "executing", "completed", "uncertain", "failed"],
        default: null,
      },
      actionHash: {
        type: String,
        default: null,
      },
      startedAt: {
        type: Date,
        default: null,
      },
      completedAt: {
        type: Date,
        default: null,
      },
      result: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
    },

    history: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    steps: {
      type: Number,
      default: 0,
    },

    error: {
      type: String,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

workflowRunSchema.index({ userId: 1, createdAt: -1 });

const WorkflowRun = mongoose.model(
  "WorkflowRun",
  workflowRunSchema
);

export default WorkflowRun;
