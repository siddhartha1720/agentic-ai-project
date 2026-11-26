
import { createHash } from "node:crypto";
import { z } from "zod";

const emailSchema = z.object({
  to: z.email(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
}).strict();

const calendarSchema = z.object({
  summary: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  startDateTime: z.iso.datetime({ offset: true }),
  endDateTime: z.iso.datetime({ offset: true }),
  timeZone: z.string().trim().min(1).default("Asia/Kolkata"),
}).strict().refine(
  (data) =>
    new Date(data.startDateTime).getTime() <
    new Date(data.endDateTime).getTime(),
  {
    message: "Invalid calendar event time range",
  }
);

export function validateApprovalAction(toolId, args) {
  let schema;

  if (toolId === "send_email") {
    schema = emailSchema;
  } else if (toolId === "create_calendar_event") {
    schema = calendarSchema;
  } else {
    throw new Error(`Tool "${toolId}" cannot be approved`);
  }

  const result = schema.safeParse(args);

  if (!result.success) {
    throw new Error(
      `Invalid approval action: ${result.error.issues
        .map((issue) => issue.message)
        .join("; ")}`
    );
  }

  return {
    toolId,
    args: result.data,
  };
}

export function hashApprovalAction(action) {
  const validated = validateApprovalAction(
    action?.toolId,
    action?.args
  );

  return createHash("sha256")
    .update(JSON.stringify(validated))
    .digest("hex");
}
