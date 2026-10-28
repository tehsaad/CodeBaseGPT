/**
 * Builds the Vercel Sandbox snapshot used by the Code Tutor runner: the default image
 * (Python 3.14, Node 24) plus gcc/g++ and a headless JDK. Run once per project, then set
 * SANDBOX_SNAPSHOT_ID to the printed id. Requires Vercel auth (vercel link && vercel env pull).
 */
import { Sandbox } from "@vercel/sandbox";

const sb = await Sandbox.create({ resources: { vcpus: 2 }, timeout: 15 * 60_000, networkPolicy: "allow-all" });
const install = await sb.runCommand({
  cmd: "bash",
  args: ["-c", "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends gcc g++ libc6-dev default-jdk-headless >/dev/null && gcc --version | head -1 && g++ --version | head -1 && javac -version"],
  sudo: true,
});
console.log(await install.stdout(), await install.stderr());
if (install.exitCode !== 0) {
  await sb.stop();
  throw new Error("toolchain install failed");
}
const snap = await sb.snapshot({ expiration: 0 });
console.log("SANDBOX_SNAPSHOT_ID=" + snap.snapshotId);
