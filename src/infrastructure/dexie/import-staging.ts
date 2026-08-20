import type {
  ExportCollectionName,
  ImportStageResult,
  ImportStagingPort,
  ValidatedImport,
} from "../../application/import-export";
import type { IsoInstant } from "../../domain/primitives";
import type { GrimoireDatabase, ImportStagingRow } from "./schema";

function stageRows(
  runId: string,
  validatedImport: ValidatedImport,
): readonly ImportStagingRow[] {
  const rows: ImportStagingRow[] = [];
  for (const [collection, records] of Object.entries(validatedImport.envelope.collections) as [
    ExportCollectionName,
    readonly unknown[],
  ][]) {
    records.forEach((value, index) => {
      rows.push({
        schemaVersion: 1,
        id: `${runId}:${collection}:${index}`,
        runId,
        collection,
        recordKey: String(index),
        value,
      });
    });
  }
  return Object.freeze(rows);
}
export class DexieImportStagingStore implements ImportStagingPort {
  constructor(private readonly database: GrimoireDatabase) {}

  stage(
    validatedImport: ValidatedImport,
    context: Readonly<{ runId: string; now: IsoInstant }>,
  ): Promise<ImportStageResult> {
    if (context.runId.length === 0) throw new RangeError("Import run ID must not be empty");
    return this.database.transaction(
      "rw",
      [this.database.importRuns, this.database.importStaging],
      async () => {
        const prior = await this.database.importRuns
          .where("sourceHash")
          .equals(validatedImport.sourceHash)
          .first();
        if (prior) {
          const recordCount = await this.database.importStaging.where("runId").equals(prior.id).count();
          return Object.freeze({
            runId: prior.id,
            sourceHash: validatedImport.sourceHash,
            recordCount,
            reused: true,
            status: "staged" as const,
          });
        }
        const rows = stageRows(context.runId, validatedImport);
        await this.database.importRuns.add({
          schemaVersion: 1,
          id: context.runId,
          sourceHash: validatedImport.sourceHash,
          status: "validating",
          createdAt: context.now,
          updatedAt: context.now,
        });
        await this.database.importStaging.bulkAdd(rows);
        await this.database.importRuns.update(context.runId, {
          status: "staged",
          updatedAt: context.now,
        });
        return Object.freeze({
          runId: context.runId,
          sourceHash: validatedImport.sourceHash,
          recordCount: rows.length,
          reused: false,
          status: "staged" as const,
        });
      },
    );
  }
}
