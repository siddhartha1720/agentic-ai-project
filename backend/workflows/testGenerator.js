import "dotenv/config";
import { generateWorkflow } from "./workflowGenerator.service.js";

async function main() {
  try {
    const workflow = await generateWorkflow(
      "Create a workflow that generates five Python interview questions for a candidate."
    );

    console.log(JSON.stringify(workflow, null, 2));
  } catch (error) {
    console.error("Generation failed:", error.message);
    process.exitCode = 1;
  }
}

main();