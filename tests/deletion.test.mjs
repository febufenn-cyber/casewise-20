import test from "node:test";
import assert from "node:assert/strict";
import { assertDeletionTransition, workerMayWriteArtifacts } from "../packages/core/src/deletion.mjs";
test("deletion is an ordered state machine", () => { assert.equal(assertDeletionTransition("active","deletion_requested"),true); assert.throws(()=>assertDeletionTransition("active","deleted"),/invalid/); });
test("workers cannot recreate data after deletion begins", () => { assert.equal(workerMayWriteArtifacts({matterStatus:"active",fileStatus:"processing",jobStatus:"running"}),true); assert.equal(workerMayWriteArtifacts({matterStatus:"deletion_pending",fileStatus:"deletion_pending",jobStatus:"running"}),false); assert.equal(workerMayWriteArtifacts({matterStatus:"active",fileStatus:"processing",jobStatus:"cancelled"}),false); });
