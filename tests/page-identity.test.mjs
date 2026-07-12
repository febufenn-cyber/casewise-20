import test from "node:test";
import assert from "node:assert/strict";
import { canonicalPageKey, normalizePolygon, pageDisplayLabel } from "../packages/core/src/page-identity.mjs";
test("printed labels never define canonical identity", () => { assert.equal(canonicalPageKey("file-1",13),"file-1:13"); assert.equal(pageDisplayLabel({pdf_page_index:13,printed_page_label:"14"}),"PDF page 14 · Printed page 14"); assert.equal(pageDisplayLabel({pdf_page_index:14,printed_page_label:"14"}),"PDF page 15 · Printed page 14"); });
test("viewer polygons use normalized coordinates", () => { assert.deepEqual(normalizePolygon([[.1,.2],[.9,.2],[.9,.3]]),[[.1,.2],[.9,.2],[.9,.3]]); assert.throws(()=>normalizePolygon([[0,0],[2,0],[1,1]]),/between 0 and 1/); });
