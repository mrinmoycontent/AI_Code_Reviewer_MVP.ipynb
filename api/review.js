export default async function handler(req, res) {
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
        error: "Please provide code to fix."
      });
    }

    if (!language || typeof language !== "string") {
      return res.status(400).json({
        error: "Please select a programming language."
      });
    }

    // Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured."
      });
    }

    const prompt = `
You are an expert software engineer and code debugging assistant.

Analyze the following ${language} code.

Your task is to:

1. Identify the bugs.
2. Explain what is wrong.
3. Correct the code.
4. Preserve the original purpose and functionality.
5. Improve obvious reliability or code-quality problems.
6. Do not invent unnecessary changes.

IMPORTANT:
The corrected code MUST be provided using exactly this format:

FIXED CODE:
\`\`\`${language}
[corrected code]
\`\`\`

After the corrected code, provide:

CHANGES:
1. [change]
2. [change]
3. [change]

Make sure the corrected code is complete and directly usable.

CODE:

\`\`\`${language}
${code}
\`\`\`
`;

    const maxAttempts = 3;

    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

      const controller = new AbortController();

      // Prevent the request from hanging indefinitely
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

        // Successful Gemini response
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
            "Gemini API request failed.";

          console.error(
            `Gemini Fix attempt ${attempt}:`,
            data
          );

          // Retry temporary errors
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
            `Gemini Fix attempt ${attempt} error:`,
            error
          );

        }

      }

      // Wait before retrying
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
