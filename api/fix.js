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

    if (code.length > 12000) {
      return res.status(400).json({
        error: "Code is too long. Please keep it under 12,000 characters."
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
        error: "Gemini API key is not configured."
      });
    }

    const prompt = `
You are an expert ${language} software developer and debugging assistant.

Analyze the following ${language} code.

Your job is to fix genuine bugs and improve code quality while preserving the original purpose.

Return the response in exactly this structure:

SUMMARY:
Briefly explain what is wrong and what you fixed.

FIXED CODE:
Provide the complete corrected code inside a markdown code block.

CHANGES:
1. Explain the first important change.
2. Explain the second important change.
3. Explain any other important change.

Do not add unnecessary complexity.
Do not change the purpose of the program.
Make the corrected code complete and directly usable.

CODE TO FIX:

\`\`\`${language}
${code}
\`\`\`
`;

    const maxAttempts = 3;

    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

      const controller = new AbortController();

      const timeout = setTimeout(() => {
        controller.abort();
      }, 30000);

      try {

        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent",
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
              ]
            }),

            signal: controller.signal
          }
        );

        clearTimeout(timeout);

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
            "Gemini request failed.";

          console.error(
            `Gemini Fix attempt ${attempt}:`,
            data
          );

          /*
           * Retry temporary Gemini errors.
           */
          if (
            response.status !== 429 &&
            response.status !== 500 &&
            response.status !== 502 &&
            response.status !== 503 &&
            response.status !== 504
          ) {

            return res.status(response.status).json({
              error: lastError
            });

          }
        }

      } catch (error) {

        clearTimeout(timeout);

        if (error.name === "AbortError") {

          lastError =
            "Gemini request timed out.";

          console.error(
            `Gemini Fix attempt ${attempt} timed out.`
          );

        } else {

          lastError = error.message;

          console.error(
            `Gemini Fix attempt ${attempt} failed:`,
            error
          );

        }
      }

      /*
       * Wait before retrying.
       */
      if (attempt < maxAttempts) {

        await new Promise(resolve =>
          setTimeout(resolve, attempt * 1500)
        );

      }
    }

    return res.status(503).json({
      error:
        "⚠️ AI fix service is temporarily unavailable. Please try again shortly."
    });

  } catch (error) {

    console.error(
      "Fix API error:",
      error
    );

    return res.status(500).json({
      error:
        "⚠️ Unable to connect to the AI fix service."
    });
  }
}
