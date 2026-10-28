import type { RunLanguage } from "@/lib/runner/languages";

/** Small programs with classic student mistakes, so the tutor has something real to explain. */
export const EXAMPLES: Record<RunLanguage, { title: string; code: string; stdin?: string }[]> = {
  python: [
    { title: "Off-by-one loop (IndexError)", code: "scores = [72, 88, 95]\n\ntotal = 0\nfor i in range(len(scores) + 1):\n    total += scores[i]\n\nprint(\"Average:\", total / len(scores))\n" },
    { title: "Reading numbers from input", code: "a = input()\nb = input()\nprint(\"Sum:\", a + b)\n", stdin: "3\n4\n" },
    { title: "Recursion without a base case", code: "def countdown(n):\n    print(n)\n    countdown(n - 1)\n\ncountdown(3)\n" },
  ],
  javascript: [
    { title: "Reading a property of undefined", code: "const users = [{ name: \"Ada\" }, { name: \"Linus\" }];\n\nfunction findUser(name) {\n  return users.find((u) => u.name === name);\n}\n\nconsole.log(findUser(\"Grace\").name.toUpperCase());\n" },
    { title: "Async code that never waits", code: "function fetchScore() {\n  return new Promise((resolve) => setTimeout(() => resolve(42), 100));\n}\n\nconst score = fetchScore();\nconsole.log(\"Score is\", score + 1);\n" },
  ],
  typescript: [
    { title: "String vs number", code: "function total(prices: string[]): number {\n  let sum = 0;\n  for (const p of prices) sum += Number(p);\n  return sum;\n}\n\nconst cart = [\"19.99\", \"5\", \"abc\"];\nconsole.log(total(cart).toFixed(2));\n" },
  ],
  c: [
    { title: "Missing semicolon (compile error)", code: "#include <stdio.h>\n\nint main(void) {\n    int count = 3\n    for (int i = 0; i < count; i++) {\n        printf(\"%d\\n\", i);\n    }\n    return 0;\n}\n" },
    { title: "Array out of bounds", code: "#include <stdio.h>\n\nint main(void) {\n    int marks[5] = {70, 80, 90, 60, 50};\n    int sum = 0;\n    for (int i = 0; i <= 5; i++) {\n        sum += marks[i];\n    }\n    printf(\"Total: %d\\n\", sum);\n    return 0;\n}\n" },
    { title: "Null pointer (segfault)", code: "#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    char *name = NULL;\n    printf(\"Length: %zu\\n\", strlen(name));\n    return 0;\n}\n" },
  ],
  cpp: [
    { title: "Integer division surprise", code: "#include <iostream>\n\nint main() {\n    int correct = 7;\n    int total = 9;\n    double percent = correct / total * 100;\n    std::cout << \"Score: \" << percent << \"%\\n\";\n}\n" },
    { title: "Vector index past the end", code: "#include <iostream>\n#include <vector>\n\nint main() {\n    std::vector<int> v = {1, 2, 3};\n    std::cout << v.at(3) << \"\\n\";\n}\n" },
  ],
  java: [
    { title: "NullPointerException", code: "public class Main {\n    static String greet(String name) {\n        return \"Hello, \" + name.trim() + \"!\";\n    }\n\n    public static void main(String[] args) {\n        String name = null;\n        System.out.println(greet(name));\n    }\n}\n" },
    { title: "Comparing strings with ==", code: "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        String answer = in.nextLine();\n        if (answer == \"yes\") {\n            System.out.println(\"Great!\");\n        } else {\n            System.out.println(\"You typed: \" + answer);\n        }\n    }\n}\n", stdin: "yes\n" },
  ],
};
