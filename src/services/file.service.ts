import { createReadStream, createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const filename = "largeFile.csv";

async function brokenApp() {
  await readFile(filename, "utf-8");
}

function readLargeFile() {
  const readStream = createReadStream(filename, { encoding: "utf-8" });

  readStream.on("data", (chunk) => {
    console.log(chunk);
  });

  readStream.on("end", () => {
    console.log("Finished reading the file");
  });
}

function transformCSVLine(line: string) {
  const parts = line.split(",");

  if (parts.length === 3) {
    parts[0] = parts[0].trim().toUpperCase();
    const alterationDate = new Date().toISOString();

    return [...parts, alterationDate].join(",");
  }

  return line + "\n";
}

async function processCSVFile(inputFilePath: string, outputFilePath: string) {
  try {
    const readStream = createReadStream(inputFilePath, { encoding: "utf-8" });
    const writeStream = createWriteStream(outputFilePath, {
      encoding: "utf-8",
    });
    const lineReader = createInterface({ input: readStream });

    const transformStream = new Transform({
      objectMode: true,
      transform(chunk: string, encoding, callback) {
        const transformedChunk = transformCSVLine(chunk);
        callback(null, transformedChunk);
        console.log(transformedChunk);
      },
    });

    await pipeline(lineReader, transformStream, writeStream);
  } catch (error) {
    console.error("Error processing CSV file:", error);
  }
}

// brokenApp();
// readLargeFile();
processCSVFile(filename, "processedFile.csv");
