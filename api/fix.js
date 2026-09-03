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
        error: "Please provide valid code."
      });
    }

    if (!language || typeof language !== "string") {
      return res.status(400).json({
        error: "Please select a programming language."
      });
    }

    const allowedLanguages = [
      "Python",
      "JavaScript",
      "Java",
      "C#",
      "C++",
      "SQL"
    ];

    if (!allowedLanguages.includes(language)) {
      return res.status(400).json({
        error: "Unsupported programming language."
      });
    }

    if (code.length > 12000) {
      return res.status(400).json({
        error: "Code is too long."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in Vercel."
      });
    }

    const prompt = `
You are an expert ${language} developer.

Review the following ${language} code.

Find genuine bugs and fix them.
Preserve the original purpose of the program.
Do not unnecessarily rewrite working code.

Return exactly:

SUMMARY:
Explain the problem and how it was fixed.

FIXED CODE:
Provide the complete corrected code inside a markdown code block.

CHANGES:
List the important changes.

CODE:
\`\`\`
${code}
\`\`\`
`;

    const maxAttempts = 3;
    let lastError = "Gemini service unavailable.";

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

      try {

        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },

            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: prompt
                    }
                  ]
                }
              ],

              generationConfig: {
                thinkingConfig: {
                  thinkingLevel: "low"
                },

                maxOutputTokens: 4096
              }
            })
          }
        );

        const data = await response.json();

        if (response.ok) {

          const result =
            data?.candidates?.[0]?.content?.parts
              ?.map(part => part.text || "")
              .join("")
              .trim();

          if (result) {
            return res.status(200).json({
              success: true,
              result: result
            });
          }

          lastError = "Gemini returned an empty response.";

        } else {

          lastError =
            data?.error?.message ||
            `HTTP ${response.status}`;

          console.error(
            `Gemini attempt ${attempt}:`,
            lastError
          );

          /*
           * Retry temporary service/capacity errors.
           * Do not retry invalid requests or authentication errors.
           */

          const retryable =
            response.status === 429 ||
            response.status === 500 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504;

          if (!retryable) {
            return res.status(response.status).json({
              error: "Gemini API error: " + lastError
            });
          }
        }

      } catch (error) {

        lastError =
          error?.message ||
          "Network request failed.";

        console.error(
          `Gemini attempt ${attempt}:`,
          lastError
        );
      }

      /*
       * Wait before retrying.
       * 1st retry: 1.5 seconds
       * 2nd retry: 3 seconds
       */

      if (attempt < maxAttempts) {
        await new Promise(resolve =>
          setTimeout(resolve, attempt * 1500)
        );
      }
    }

    return res.status(503).json({
      error:
        "AI Fix service is temporarily unavailable. " +
        "Gemini is currently busy. Please try again shortly.",
      details: lastError
    });

  } catch (error) {

    console.error("Fix API error:", error);

    return res.status(500).json({
      error:
        "AI Fix failed: " +
        (error?.message || "Unknown server error.")
    });
  }
}
