#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

console.log("=== GharFlow AI Agent Evolution Engine (a-evolve) ===");

// 1. Solve Phase: Load benchmark dataset
const manifestPath = path.resolve("demo/evaluation-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
console.log(`[Benchmark] Loaded ${manifest.documents.length} evaluation documents from ${manifest.name}`);

// 2. Observe Phase: Run test suite as gating mechanism
console.log("[Gate] Running full regression and finding audit suite (npm test)...");
try {
  const testOutput = execSync("npm test", { encoding: "utf8" });
  const passMatch = testOutput.match(/pass\s+(\d+)/);
  const failMatch = testOutput.match(/fail\s+(\d+)/);
  const passedCount = passMatch ? parseInt(passMatch[1], 10) : 0;
  const failedCount = failMatch ? parseInt(failMatch[1], 10) : 0;

  console.log(`[Gate Results] Passed: ${passedCount}, Failed: ${failedCount}`);
  if (failedCount > 0) {
    console.error("[Gate Failed] Regressions detected. Rollback required.");
    process.exit(1);
  }

  // 3. Evolve Phase: Record successful cycle snapshot
  const score = ((passedCount / (passedCount + failedCount)) * 100).toFixed(1);
  console.log(`[Score] Agent benchmark pass rate: ${score}%`);

  const memoryPath = path.resolve("evolve/memory/episodic.jsonl");
  const newEntry = JSON.stringify({
    timestamp: new Date().toISOString(),
    benchmark: manifest.name,
    score: `${score}%`,
    testsPassed: passedCount,
    status: "verified",
  });
  writeFileSync(memoryPath, readFileSync(memoryPath, "utf8") + newEntry + "\n");
  console.log("[Evolve] Recorded benchmark metrics to evolve/memory/episodic.jsonl");
  console.log("=== Evolution Cycle Completed Successfully ===");
} catch (error) {
  console.error("[Gate Error]", error.message);
  process.exit(1);
}
