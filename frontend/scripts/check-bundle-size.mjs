import fs from "node:fs";
import path from "node:path";

const distAssetsDir = path.resolve(process.cwd(), "dist", "assets");
const maxChunkKb = Number(process.env.MAX_CHUNK_KB || "1200");

if (!Number.isFinite(maxChunkKb) || maxChunkKb <= 0) {
  console.error("Invalid MAX_CHUNK_KB value. Provide a positive number.");
  process.exit(2);
}

if (!fs.existsSync(distAssetsDir)) {
  console.error(`Build assets directory not found: ${distAssetsDir}`);
  console.error("Run `npm run build` before running bundle checks.");
  process.exit(2);
}

const chunkFiles = fs
  .readdirSync(distAssetsDir)
  .filter((name) => name.endsWith(".js"))
  .map((name) => {
    const filePath = path.join(distAssetsDir, name);
    const sizeBytes = fs.statSync(filePath).size;
    return {
      name,
      sizeBytes,
      sizeKb: sizeBytes / 1024,
    };
  })
  .sort((a, b) => b.sizeBytes - a.sizeBytes);

if (chunkFiles.length === 0) {
  console.error("No JavaScript chunks found in dist/assets.");
  process.exit(2);
}

const violations = chunkFiles.filter((chunk) => chunk.sizeKb > maxChunkKb);

console.log(`Bundle gate: MAX_CHUNK_KB=${maxChunkKb}`);
console.log("Top 5 chunks:");
for (const chunk of chunkFiles.slice(0, 5)) {
  console.log(`- ${chunk.name}: ${chunk.sizeKb.toFixed(2)} kB`);
}

if (violations.length > 0) {
  console.error("\nChunk size gate failed. Oversized chunks:");
  for (const chunk of violations) {
    console.error(`- ${chunk.name}: ${chunk.sizeKb.toFixed(2)} kB`);
  }
  process.exit(1);
}

console.log("Chunk size gate passed.");
