/**
 * ======================= QUESTION BANK =======================
 * Lecturer: edit/add questions here.
 *
 * THEORY (multiple choice):
 *   - options: list of answers shown in order
 *   - answer: index (0-based) of the correct option
 *   - explain: feedback shown after the student checks their answer.
 *     Can be a single string, or an array with one entry per option
 *     (so wrong choices get targeted feedback).
 *
 * CODING:
 *   - kind: "write" (student writes the solution) or "debug"
 *     (starter contains buggy code the student must fix).
 *   - starter: code pre-filled in the editor
 *   - tests: each test feeds `stdin` to the compiled program and
 *     compares the program output with `expected` (trailing spaces /
 *     newlines ignored, comparison is whitespace-tolerant per line).
 *   - hints: static checks run on the source code, each producing a
 *     feedback `message`. Two forms:
 *       { pattern: /regex/, message } — fires when the pattern is
 *         MISSING from the code (e.g. "no loop found");
 *       { pattern: /regex/, fireWhen: "present", message } — fires
 *         when the pattern is STILL in the code (e.g. a bug that the
 *         student has not fixed yet in a debugging question).
 *   - marks: full marks for the question; awarded proportionally to
 *     the number of test cases passed.
 */

/**
 * Theory questions are DISABLED for the 1-hour quiz.
 * To bring them back, move entries from THEORY_QUESTIONS_DISABLED
 * into THEORY_QUESTIONS below.
 */
const THEORY_QUESTIONS = [];

const THEORY_QUESTIONS_DISABLED = [
  {
    id: "T1",
    marks: 2,
    text: "Which of the following is the correct way to declare an integer variable in C++ and initialise it to 10?",
    options: [
      "int x = 10;",
      "integer x = 10;",
      "x int = 10;",
      "int x == 10;"
    ],
    answer: 0,
    explain: [
      "Correct! `int` is the keyword for integers, and `=` assigns an initial value.",
      "C++ uses the keyword `int`, not `integer`.",
      "The type must come BEFORE the variable name: `int x = 10;`.",
      "`==` is the comparison operator. To assign a value, use a single `=`."
    ]
  },
  {
    id: "T2",
    marks: 2,
    text: "What is the output of the following code?",
    code: "int a = 7, b = 2;\ncout << a / b;",
    options: ["3.5", "3", "4", "Compilation error"],
    answer: 1,
    explain: [
      "Not quite — both `a` and `b` are `int`, so the division is INTEGER division. The decimal part is discarded.",
      "Correct! Integer division discards the decimal part, so 7 / 2 gives 3.",
      "Integer division truncates (cuts off) the decimal part — it does not round up.",
      "The code is valid C++. Both operands are `int`, so this is integer division giving 3."
    ]
  },
  {
    id: "T3",
    marks: 2,
    text: "How many times does this loop print \"Hi\"?",
    code: "for (int i = 0; i < 5; i++) {\n    cout << \"Hi\" << endl;\n}",
    options: ["4 times", "5 times", "6 times", "Infinite loop"],
    answer: 1,
    explain: [
      "Count carefully: i takes the values 0, 1, 2, 3, 4 — that is 5 iterations, not 4.",
      "Correct! i runs through 0, 1, 2, 3, 4 (five values) and stops when i becomes 5.",
      "The loop stops as soon as `i < 5` is false, i.e. when i reaches 5 — so the body runs 5 times.",
      "The loop variable increases each iteration and the condition eventually fails, so it is not infinite."
    ]
  },
  {
    id: "T4",
    marks: 2,
    text: "Which statement about functions in C++ is TRUE?",
    options: [
      "A function declared with return type `void` must return a value.",
      "Function parameters passed by value can modify the caller's variable.",
      "A function must be declared or defined before it is called.",
      "A C++ program can have more than one main() function."
    ],
    answer: 2,
    explain: [
      "`void` means the function returns NOTHING — it must not return a value.",
      "Pass-by-value copies the argument; changes inside the function do not affect the caller. Use references (&) to modify the original.",
      "Correct! The compiler must know the function's prototype before the call — via a declaration (prototype) or the full definition.",
      "Every C++ program has exactly ONE main() — it is the entry point."
    ]
  },
  {
    id: "T5",
    marks: 2,
    text: "Given `int arr[5] = {10, 20, 30, 40, 50};`, what does `arr[2]` evaluate to?",
    options: ["20", "30", "40", "2"],
    answer: 1,
    explain: [
      "Remember that array indexing starts at 0 — arr[1] is 20, but arr[2] is the THIRD element.",
      "Correct! Indexing starts at 0, so arr[2] is the third element: 30.",
      "arr[3] is 40. arr[2] is the third element, 30.",
      "arr[2] gives the ELEMENT stored at index 2, not the index itself."
    ]
  }
];

const CODING_QUESTIONS = [
  {
    id: "C1",
    kind: "write",
    marks: 5,
    title: "Sum of Two Numbers",
    text: "Write a complete C++ program that reads two integers from input and prints their sum on one line.",
    example: "Input:\n3 4\nOutput:\n7",
    starter:
`#include <iostream>
using namespace std;

int main() {
    // Read two integers and print their sum

    return 0;
}`,
    tests: [
      { stdin: "3 4",     expected: "7" },
      { stdin: "10 -2",   expected: "8" },
      { stdin: "100 250", expected: "350" }
    ],
    hints: [
      { pattern: /cin\s*>>/, message: "Your program never reads input — use `cin >> a >> b;` to read the two integers." },
      { pattern: /cout\s*<</, message: "Your program never prints anything — use `cout` to output the sum." },
      { pattern: /\+/, message: "It looks like you never add the two numbers (no `+` operator found)." }
    ]
  },
  {
    id: "C2",
    kind: "write",
    marks: 5,
    title: "Even or Odd",
    text: "Write a complete C++ program that reads one integer and prints \"EVEN\" if it is even, or \"ODD\" if it is odd (exactly in capital letters, no extra words).",
    example: "Input:\n6\nOutput:\nEVEN",
    starter:
`#include <iostream>
using namespace std;

int main() {

    return 0;
}`,
    tests: [
      { stdin: "6",  expected: "EVEN" },
      { stdin: "13", expected: "ODD" },
      { stdin: "0",  expected: "EVEN" },
      { stdin: "-7", expected: "ODD" }
    ],
    hints: [
      { pattern: /%/, message: "Hint: the modulus operator `%` gives the remainder of a division — `n % 2` tells you if n is even or odd." },
      { pattern: /if\s*\(/, message: "You need an `if` statement to choose between the two outputs." },
      { pattern: /cin\s*>>/, message: "Your program never reads input — use `cin >>` to read the integer." }
    ]
  },
  {
    id: "C3",
    kind: "write",
    marks: 6,
    title: "Sum 1 to N with a Loop",
    text: "Write a complete C++ program that reads a positive integer N and uses a LOOP to calculate and print the sum 1 + 2 + ... + N.",
    example: "Input:\n5\nOutput:\n15",
    starter:
`#include <iostream>
using namespace std;

int main() {

    return 0;
}`,
    tests: [
      { stdin: "5",   expected: "15" },
      { stdin: "1",   expected: "1" },
      { stdin: "100", expected: "5050" }
    ],
    hints: [
      { pattern: /\b(for|while)\b/, message: "The question requires a LOOP (`for` or `while`) — none was found in your code." },
      { pattern: /cin\s*>>/, message: "Your program never reads input — use `cin >>` to read N." },
      { pattern: /cout\s*<</, message: "Your program never prints anything — use `cout` to output the sum." }
    ]
  },
  {
    id: "C4",
    kind: "write",
    marks: 7,
    title: "Maximum with a Function",
    text: "Complete the function `maxOfThree` so it returns the largest of the three integers. Do not change main().",
    example: "Input:\n4 9 2\nOutput:\n9",
    starter:
`#include <iostream>
using namespace std;

// Return the largest of a, b and c
int maxOfThree(int a, int b, int c) {
    // TODO: write your code here

}

int main() {
    int a, b, c;
    cin >> a >> b >> c;
    cout << maxOfThree(a, b, c);
    return 0;
}`,
    tests: [
      { stdin: "4 9 2",    expected: "9" },
      { stdin: "10 3 7",   expected: "10" },
      { stdin: "1 2 30",   expected: "30" },
      { stdin: "5 5 5",    expected: "5" }
    ],
    hints: [
      { pattern: /return/, message: "Your function has no `return` statement — it must RETURN the largest value." },
      { pattern: /if|\?|max/, message: "Compare the values using `if` statements (or the `?:` operator, or `max()`)." }
    ]
  },

  /* ==================== DEBUGGING QUESTIONS ==================== */
  {
    id: "D1",
    kind: "debug",
    marks: 4,
    title: "Fix the Compile Errors",
    text: "The following program should read the width and height of a rectangle and print its area — but it does NOT compile. Fix the errors WITHOUT changing what the program is supposed to do.",
    example: "Input:\n4 5\nOutput:\n20",
    starter:
`#include <iostream>
using namespace std;

int main() {
    int width, height
    cin >> width >> height;
    cout << "Area: " << width * height << endl
    return 0;
}`,
    tests: [
      { stdin: "4 5",  expected: "Area: 20" },
      { stdin: "7 3",  expected: "Area: 21" },
      { stdin: "10 10", expected: "Area: 100" }
    ],
    hints: [
      { pattern: /int\s+width\s*,\s*height\s*\n/, fireWhen: "present",
        message: "Look carefully at the variable declaration line — every C++ statement must end with a semicolon `;`." },
      { pattern: /endl\s*\n/, fireWhen: "present",
        message: "Check the `cout` line — is the statement properly terminated?" }
    ]
  },
  {
    id: "D2",
    kind: "debug",
    marks: 5,
    title: "Fix the Logic Error (Average)",
    text: "This program should read two integers and print their average as a DECIMAL number (e.g. the average of 3 and 4 is 3.5). It compiles and runs, but prints the wrong answer for odd sums. Find and fix the bug.",
    example: "Input:\n3 4\nOutput:\n3.5",
    starter:
`#include <iostream>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;
    double average = (a + b) / 2;
    cout << average;
    return 0;
}`,
    tests: [
      { stdin: "3 4",  expected: "3.5" },
      { stdin: "10 5", expected: "7.5" },
      { stdin: "2 4",  expected: "3" }
    ],
    hints: [
      { pattern: /\(\s*a\s*\+\s*b\s*\)\s*\/\s*2\s*;/, fireWhen: "present",
        message: "`(a + b) / 2` divides an integer by an integer, so C++ throws away the decimal part BEFORE storing it in the double. Make the division a floating-point division (e.g. divide by `2.0` or cast to `double`)." }
    ]
  },
  {
    id: "D3",
    kind: "debug",
    marks: 5,
    title: "Fix the Loop Bugs",
    text: "This program should print the numbers 1 to N separated by spaces, then print the count of numbers printed on the next line. It has TWO bugs — one makes it stop too early, one makes the count wrong. Fix both.",
    example: "Input:\n5\nOutput:\n1 2 3 4 5\nCount: 5",
    starter:
`#include <iostream>
using namespace std;

int main() {
    int n, count = 0;
    cin >> n;
    for (int i = 1; i < n; i++) {
        cout << i << " ";
        count = count + 2;
    }
    cout << endl << "Count: " << count;
    return 0;
}`,
    tests: [
      { stdin: "5", expected: "1 2 3 4 5\nCount: 5" },
      { stdin: "1", expected: "1\nCount: 1" },
      { stdin: "8", expected: "1 2 3 4 5 6 7 8\nCount: 8" }
    ],
    hints: [
      { pattern: /i\s*<\s*n/, fireWhen: "present",
        message: "The loop condition `i < n` stops BEFORE printing n itself — check whether it should be `<=`." },
      { pattern: /count\s*=\s*count\s*\+\s*2|count\s*\+=\s*2/, fireWhen: "present",
        message: "Each loop iteration prints ONE number — but look at how much `count` increases each time." }
    ]
  }
];
