import { assert } from "../dev_deps.ts";
import * as utils from "./utils.ts";

Deno.test("protect", function testLib() {
  assert(utils.protect("a") === "a");
});

Deno.test("toExecCmd", function testLib() {
  assert(utils.toExecCmd("a", ["b", "c"]) === "a b c");
});

Deno.test("exec", async function testLib() {
  const result = await utils.exec("echo foo");
  assert(result.trim() === "foo", `result value is "${result}"`);
});

Deno.test("execSync", function testLib() {
  const result = utils.execSync("echo foo");
  assert(result.trim() === "foo", `result value is "${result}"`);
});
