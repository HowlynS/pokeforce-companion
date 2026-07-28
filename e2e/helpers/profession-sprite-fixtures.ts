import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  E2EPublicProfessionSpriteBytes,
  E2EPublicProfessionSpriteKey,
} from "./database-cleanup";

const PROFESSION_SPRITE_FILES = {
  celestineRelayCore: "celestine-relay-core.png",
  kilnkeeperCrucible: "kilnkeeper-crucible.png",
  courierTensionSpool: "courier-tension-spool.png",
  restorativePrimer: "restorative-primer.png",
  aetherglassTonic: "aetherglass-tonic.png",
  captureWeave: "capture-weave.png",
  gigatonPressCollar: "gigaton-press-collar.png",
  duskworkLens: "duskwork-lens.png",
} satisfies Record<E2EPublicProfessionSpriteKey, string>;

const PROFESSION_SPRITE_HASHES = {
  celestineRelayCore:
    "3d127f63067921483cf47f1007b2baf28c0e77f8a37e413c034eb32e7832f759",
  kilnkeeperCrucible:
    "295f722b53fe5d07d654016c614659fa42f26c8a603ee86a9214943ca7ef8a70",
  courierTensionSpool:
    "ba5a349d0d7d120028302a92c08b801893f000fb25edeefd91dcf166e1943aad",
  restorativePrimer:
    "7c3e56dc8728065ed0c18a4b5532236fbaaa24604a5b884e66ddd315762884f3",
  aetherglassTonic:
    "1760808f2bcf68ac35a58a5d6d5b18a3700520d2223f114698d5a75e29e75fdd",
  captureWeave:
    "d3e8467468c330d5ee9ac9d98aa72d5b306713e3c87d38ccb4162a6d78e48ced",
  gigatonPressCollar:
    "ea088ee0fbcc876347f49f3e2ee7bef708010db377dd2444b86e489689f96789",
  duskworkLens:
    "925073e337c0b0f69a84971f97c91e853422bab1e408d3191658d03533f3fb10",
} satisfies Record<E2EPublicProfessionSpriteKey, string>;

function assertSpriteProperty(
  condition: boolean,
  fixtureFile: string,
  property: string
): void {
  if (!condition) {
    throw new Error(
      `Profession sprite fixture "${fixtureFile}" failed ${property} validation.`
    );
  }
}

export function readValidatedProfessionSpriteBytes(
  fixtureDirectory: string
): E2EPublicProfessionSpriteBytes {
  const spriteBytes = {} as E2EPublicProfessionSpriteBytes;

  for (const [spriteKey, fixtureFile] of Object.entries(
    PROFESSION_SPRITE_FILES
  ) as Array<[E2EPublicProfessionSpriteKey, string]>) {
    const bytes = fs.readFileSync(path.join(fixtureDirectory, fixtureFile));
    assertSpriteProperty(
      bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
      fixtureFile,
      "PNG signature"
    );
    assertSpriteProperty(
      bytes.subarray(12, 16).toString("ascii") === "IHDR",
      fixtureFile,
      "IHDR"
    );
    assertSpriteProperty(
      bytes.readUInt32BE(16) === 32 && bytes.readUInt32BE(20) === 32,
      fixtureFile,
      "32×32 dimensions"
    );
    assertSpriteProperty(
      bytes[24] === 8 && bytes[25] === 6,
      fixtureFile,
      "8-bit RGBA transparency"
    );
    assertSpriteProperty(
      createHash("sha256").update(bytes).digest("hex") ===
        PROFESSION_SPRITE_HASHES[spriteKey],
      fixtureFile,
      "byte-preserving SHA-256"
    );
    spriteBytes[spriteKey] = bytes;
  }

  return spriteBytes;
}
