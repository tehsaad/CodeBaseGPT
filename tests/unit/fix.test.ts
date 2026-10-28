import { describe, expect, it } from "vitest";
import { extractFixedCode, lineDiff } from "@/lib/client/fix";

const answer = `## What happened
It crashed.
## Fixed version
\`\`\`python
nums = [1, 2, 3]
print(nums[2])
\`\`\`
Changed the index.
## Check your understanding
Why?`;

describe("tutor fix proposals", () => {
  it("extracts only the code under 'Fixed version'", () => {
    expect(extractFixedCode(answer)).toBe("nums = [1, 2, 3]\nprint(nums[2])");
    expect(extractFixedCode("## Hint\n```py\nx\n```")).toBeNull();
    expect(extractFixedCode("## Fixed version\nno code here")).toBeNull();
  });

  it("produces a numbered line diff", () => {
    const d = lineDiff("nums = [1, 2, 3]\nprint(nums[3])\n", "nums = [1, 2, 3]\nprint(nums[2])");
    expect(d.added).toBe(1);
    expect(d.removed).toBe(1);
    expect(d.lines).toEqual([
      { kind: "same", text: "nums = [1, 2, 3]", oldNo: 1, newNo: 1 },
      { kind: "del", text: "print(nums[3])", oldNo: 2, newNo: null },
      { kind: "add", text: "print(nums[2])", oldNo: null, newNo: 2 },
    ]);
    expect(lineDiff("a\n", "a").added).toBe(0);
  });
});
