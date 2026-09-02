export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { code, language } = req.body || {};

    // Validate input
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

    /*
      IMPORTANT:
      This endpoint intentionally does NOT execute arbitrary user code.

      Actual execution requires a properly sandboxed code-execution
      service. For now, we return a safe validation response so the
      frontend can communicate with this endpoint without sending
      execution requests to Gemini.
    */

    return res.status(200).json({
      success: true,
      language: language,
      status: "VALIDATION_ONLY",
      message:
        `Code received successfully for ${language}. ` +
        "Actual execution is not enabled yet.",
      codeLength: code.length
    });

  } catch (error) {

    console.error("Run API error:", error);

    return res.status(500).json({
      error: "Unable to process the code test request."
    });
  }
}
