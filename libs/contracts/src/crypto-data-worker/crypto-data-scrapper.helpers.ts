export function splitIntoChunks<T>(items: T[], chunksCount: number): T[][] {
  const result: T[][] = [];
  const chunkSize = Math.ceil(items.length / chunksCount);

  for (let i = 0; i < chunksCount; i++) {
    const start = i * chunkSize;
    const end = start + chunkSize;
    result.push(items.slice(start, end));
  }

  return result;
}

export function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const result: T[][] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    result.push(items.slice(i, i + batchSize));
  }

  return result;
}