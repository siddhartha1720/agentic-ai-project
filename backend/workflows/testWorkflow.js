import { validateWorkflow } from "./workflowSchema.js";

const sampleWorkflow = {
  name: "Interview Preparation Workflow",
  description: "Generate interview questions for a candidate",
  nodes: [
    {
      id: "start1",
      type: "start",
      name: "Start",
      config: {},
    },
    {
      id: "ai1",
      type: "ai_task",
      name: "Generate Questions",
      config: {
        prompt: "Generate five Python interview questions.",
      },
    },
    {
      id: "end1",
      type: "end",
      name: "End",
      config: {},
    },
  ],
  edges: [
    { source: "start1", target: "ai1" },
    { source: "ai1", target: "end1" },
  ],
};

const result = validateWorkflow(sampleWorkflow);

console.log("Workflow valid:", result.success);

if (!result.success) {
  console.log(result.error.issues);
}