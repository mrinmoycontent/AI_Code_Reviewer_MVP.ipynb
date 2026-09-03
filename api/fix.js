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

    if (code.length > 12000) {
      return res.status(400).json({
        error: "Code is too long."
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

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in Vercel."
      });
    }

    const prompt = `
You are an expert ${language} software developer.

Review the following ${language} code.

Find genuine bugs and fix them while preserving the original purpose.

Return exactly:

SUMMARY:
Explain the problem and solution.

FIXED CODE:
Provide the complete corrected code inside a markdown code block.

CHANGES:
List the important changes.

CODE:

\`\`\`${language}
${code}
\`\`\`
`;

    const model = "gemini-3.8-flash";

    let lastError = "";

    // Try up to 3 times for temporary Google service errors.
    for (let attempt = 1; attempt <= 3; attempt++) {

      try {

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },

            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: prompt
                    }
                  ]
                }
              ],

              generationConfig: {
                temperature: 0.2,
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

          return res.status(502).json({
            error: "Gemini returned an empty response."
          });
        }

        lastError =
          data?.error?.message ||
          `HTTP ${response.status}`;

        // Retry only temporary errors.
        if (
          response.status !== 429 &&
          response.status !== 500 &&
          response.status !== 502 &&
          response.status !== 503 &&
          response.status !== 504
        ) {
          return res.status(response.status).json({
            error: "Gemini API error: " + lastError
          });
        }

        // Wait before retrying.
        if (attempt < 3) {
          await new Promise(resolve =>
            setTimeout(resolve, attempt * 2000)
          );
        }

      } catch (error) {

        lastError =
          error?.message ||
          "Network request failed.";

        if (attempt < 3) {
          await new Promise(resolve =>
            setTimeout(resolve, attempt * 2000)
          );
        }
      }
    }

    return res.status(503).json({
      error:
        "Gemini is temporarily unavailable. " +
        "Google returned: " +
        lastError
    });

  } catch (error) {

    console.error("Fix API error:", error);

    return res.status(500).json({
      error:
        "Server error: " +
        (error?.message || "Unknown error.")
    });
  }
}
