// Read-only resource evidence for the local hosted container after the smoke journey.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const name = process.env.RESOURCE_CONTAINER ?? "gharflowai-web-1";
const [container] = JSON.parse(
  execFileSync("docker", ["inspect", name], { encoding: "utf8" }),
);
assert.equal(
  container.HostConfig.Memory,
  512 * 1024 * 1024,
  "Use compose.hosted.yaml for the constrained check",
);
assert.equal(
  container.HostConfig.NanoCpus,
  100000000,
  "Expected 0.1 CPU allocation",
);
assert.equal(container.State.OOMKilled, false);
const bytes = Number(
  execFileSync("docker", ["exec", name, "cat", "/sys/fs/cgroup/memory.peak"], {
    encoding: "utf8",
  }).trim(),
);
assert.ok(
  bytes > 0 && bytes <= 512 * 1024 * 1024,
  "Container exceeded memory budget",
);
const [image] = JSON.parse(
  execFileSync("docker", ["image", "inspect", container.Image], {
    encoding: "utf8",
  }),
);
console.log(
  JSON.stringify(
    {
      architecture: image.Architecture,
      memoryLimitMiB: 512,
      cpuAllocation: 0.1,
      kernelPeakMiB: Math.round((bytes / 1048576) * 10) / 10,
      oomKilled: container.State.OOMKilled,
    },
    null,
    2,
  ),
);
