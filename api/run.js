export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { code, language } = req.body || {};

    if (!code || typeof code !== "string") {
      return res.status(400).json({
        error: "Please provide code to test."
      });
    }

    if (!language || typeof language !== "string") {
      return res.status(400).json({
        error: "Please select a programming language."
      });
    }

    const supportedLanguages = [
      "Python",
      "JavaScript",
      "Java",
      "C#",
      "C++",
      "SQL"
    ];

    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        error: "Unsupported programming language."
      });
    }

    const errors = [];
    const warnings = [];

    // Python checks
    if (language === "Python") {
      if (/^\s*def\s+\w+\s*\([^)]*\)\s*:/m.test(code)) {
        if (/\/\s*len\s*\(/.test(code)) {
          warnings.push(
            "Check for division by zero when the list is empty."
          );
        }
      }

      if (/\bprint\s*\([^)]*\)\s*$/m.test(code)) {
        // Valid Python print usage.
      }
    }

    // JavaScript checks
    if (language === "JavaScript") {
      if (/\bconst\s+\w+\s*=\s*["']\d+["']/.test(code)) {
        warnings.push(
          "A numeric value is stored as a string. Check type handling."
        );
      }

      if (/console\.log\s*\(/.test(code)) {
        // Normal JavaScript output.
      }
    }

    // Java checks
    if (language === "Java") {
      const arrayMatches = code.match(/new\s+\w+\[\]\s*\{[^}]*\}/g);

      if (arrayMatches && /i\s*<=\s*\w+\.length/.test(code)) {
        errors.push(
          "Possible array index error: use i < array.length instead of i <= array.length."
        );
      }
    }

    // C# checks
    if (language === "C#") {
      if (/return\s+\w+\s*\/\s*\w+\s*;/.test(code) && /\b=\s*0\s*;/.test(code)) {
        warnings.push(
          "Possible division by zero. Check the denominator before division."
        );
      }
    }

    // C++ checks
    if (language === "C++") {
      if (/for\s*\([^;]*;\s*[^;]*<=\s*\d+\s*;/.test(code)) {
        warnings.push(
          "Check array boundaries when using <= in a loop."
        );
      }
    }

    // SQL checks
    if (language === "SQL") {
      if (/\bWHERE\b[\s\S]*\bSUM\s*\(/i.test(code)) {
        errors.push(
          "Aggregate functions such as SUM() should normally be filtered with HAVING rather than WHERE."
        );
      }

      if (/\bGROUP\s+BY\b/i.test(code) && /\bSUM\s*\(/i.test(code)) {
        warnings.push(
          "Check that all selected non-aggregated columns are included in GROUP BY."
        );
      }
    }

    const status =
      errors.length > 0
        ? "ISSUES_FOUND"
        : warnings.length > 0
        ? "WARNINGS_FOUND"
        : "PASSED";

    let result = `TEST RESULT: ${status}\n\n`;

    if (errors.length > 0) {
      result += "ERRORS:\n";
      errors.forEach((error) => {
        result += `• ${error}\n`;
      });
      result += "\n";
    }

    if (warnings.length > 0) {
      result += "WARNINGS:\n";
      warnings.forEach((warning) => {
        result += `• ${warning}\n`;
      });
      result += "\n";
    }

    if (errors.length === 0 && warnings.length === 0) {
      result +=
        "No obvious issues were detected by the built-in validation checks.\n\n";
    }

    result += `Language: ${language}\n`;
    result += `Code length: ${code.length} characters\n`;
    result +=
      "\nNote: This test performs static validation. It does not execute arbitrary code.";

    return res.status(200).json({
      success: true,
      language,
      status,
      result
    });

  } catch (error) {
    console.error("Run API error:", error);

    return res.status(500).json({
      error:
        "Unable to process the code test request: " +
        (error?.message || "Unknown error")
    });
  }
}
