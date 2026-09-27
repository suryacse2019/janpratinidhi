import assert from "node:assert/strict";
import { test } from "node:test";
import { representativesRouter } from "../src/routes/representatives.js";
import { RepresentativeModel } from "../src/models/Representative.js";

const handler = (path: string) =>
  representativesRouter.stack.find(
    (layer: any) => layer.route?.path === path && layer.route.methods.get,
  )!.route.stack[0].handle;
async function request(path: string, query: Record<string, string> = {}) {
  let status = 200;
  let body: any;
  await handler(path)(
    { query },
    {
      status(code: number) {
        status = code;
        return this;
      },
      json(value: unknown) {
        body = value;
      },
    },
    (error: unknown) => {
      throw error;
    },
  );
  return { status, body };
}

test("geography includes only published non-sample supported offices and groups every constituency", async () => {
  const original = RepresentativeModel.aggregate;
  let pipeline: any[] = [];
  (RepresentativeModel as any).aggregate = async (stages: any[]) => {
    pipeline = stages;
    return [{ state: "Bihar", constituency: "Patna", office: "MLA", count: 2 }];
  };
  try {
    const { body } = await request("/geography");
    assert.equal(pipeline[0].$match.status, "published");
    assert.deepEqual(pipeline[0].$match.sample, { $ne: true });
    assert.deepEqual(pipeline[1].$group._id, {
      state: "$state",
      constituency: "$constituency",
      office: "$office",
    });
    assert.equal(
      pipeline.some((stage) => stage.$limit || stage.$skip),
      false,
    );
    assert.equal(body.data[0].count, 2);
  } finally {
    RepresentativeModel.aggregate = original;
  }
});

test("constituency filters escape regex characters and retain published state filters", async () => {
  const original = RepresentativeModel.aggregate;
  let filter: any;
  (RepresentativeModel as any).aggregate = async (pipeline: any[]) => {
    filter = pipeline[0].$match;
    return [];
  };
  try {
    const result = await request("/", { state: "Bihar", constituency: "  Patna (West).*  " });
    assert.equal(result.status, 200);
    assert.equal(filter.state, "Bihar");
    assert.equal(filter.status, "published");
    assert.deepEqual(filter.constituency, { $regex: "^Patna \\(West\\)\\.\\*$", $options: "i" });
    assert.deepEqual(result.body.pagination, { page: 1, limit: 50, total: 0, totalPages: 0 });
    assert.equal((await request("/", { constituency: "a".repeat(151) })).status, 400);
  } finally {
    RepresentativeModel.aggregate = original;
  }
});
