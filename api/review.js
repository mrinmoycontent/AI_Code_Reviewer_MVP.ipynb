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
        error: "Please provide code to review."
      });
    }

    if (!language || typeof language !== "string") {
      return res.status(400).json({
        error: "Please select a programming language."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured."
      });
    }

    const prompt = `
You are an expert software code reviewer.

Review the following ${language} code.

Provide a professional structured review containing:

1. Bugs
2. Security Issues
3. Code Quality Problems
4. Performance Issues
5. Recommended Improvements
6. Improved Code

For the improved code, use this exact format:

FIXED CODE:
\`\`\`${language}
[corrected code]
\`\`\`

Finally provide:

Final Code Quality Score: X/100

Be accurate. Do not invent problems that are not present in the code.

CODE TO REVIEW:

\`\`\`${language}
${code}
\`\`\`
`;

    const maxAttempts = 3;

    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

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
          "Gemini API request failed.";

        console.error(
          `Gemini attempt ${attempt}:`,
          data
        );

        /*
          Retry temporary server/capacity errors.
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

      /*
        Wait before retrying.
        1 second, then 2 seconds.
      */
      if (attempt < maxAttempts) {
        await new Promise(resolve =>
          setTimeout(resolve, attempt * 1000)
        );
      }
    }

    return res.status(503).json({
      error:
        "⚠️ Gemini is temporarily unavailable. Please try again shortly."
    });

  } catch (error) {

    console.error("Review API error:", error);

    return res.status(500).json({
      error:
        "⚠️ Unable to connect to the AI service. Please try again."
    });
  }
}
