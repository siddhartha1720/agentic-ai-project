
import "dotenv/config";
import { generateWorkflow } from "./workflowGenerator.service.js";
import { executeWorkflow } from "./workflowExecutor.js";

async function main() {
  try {
    const prompt =
      "Create a workflow that generates five Python interview questions for a junior developer.";

    console.log("1. Generating workflow...");
    const workflow = await generateWorkflow(prompt);

    console.log("2. Executing workflow...");
    const result = await executeWorkflow(
      workflow,
      "Candidate level: Junior Python Developer"
    );

    console.log("\nStatus:", result.status);
    console.log("\nFinal Output:\n", result.output);
    console.log("\nExecution History:");
    console.log(
      result.history.map(({ nodeId, type, status }) => ({
        nodeId,
        type,
        status,
      }))
    );
  } catch (error) {
    console.error("Workflow test failed:", error.message);
    process.exitCode = 1;
  }
}

main();
