import { assertEquals } from "../dev_deps.ts";
import { args2Option } from "./misc.ts";

Deno.test("utils", () => {
  Deno.test("args2Option should parse standalone unknown bool flags", () => {
    const env = args2Option(["--FOO"]);
    if (env.extra) {
      assertEquals(env.extra.FOO, "1");
    }
  });

  Deno.test("args2Option should parse unknown flags with value", () => {
    const env = args2Option(["--FOO", "bar"]);
    if (env.extra) {
      assertEquals(env.extra.FOO, "bar");
    }
  });

  Deno.test("args2Option should parse unknown string flags with value", () => {
    const env = args2Option(["--FOO=bar"]);
    if (env.extra) {
      assertEquals(env.extra.FOO, "bar");
    }
  });
});
