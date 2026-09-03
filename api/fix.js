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
        error: "GEMINI_API_KEY is not configured in Vercel."
      });
    }

    const prompt = `
You are an expert ${language} software developer and debugging assistant.

Analyze the following ${language} code.

Fix genuine bugs while preserving the original purpose of the program.

Return exactly:

SUMMARY:
Explain the problem and what you fixed.

FIXED CODE:
Provide the complete corrected code inside a markdown code block.

CHANGES:
1. Explain the first important change.
2. Explain the second important change.
3. Explain any other important change.

Do not add unnecessary complexity.

CODE:

\`\`\`${language}
${code}
\`\`\`
`;

    /*
      Try several current Gemini Flash models.
      If one is temporarily overloaded, automatically
      try the next model.
    */

    const models = [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite"
    ];

    let lastError = "";

    for (const model of models) {

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
              ]
            })
          }
        );

        const data = await response.json();

        /*
          Successful Gemini response
        */

        if (response.ok) {

          const result =
            data?.candidates?.[0]?.content?.parts
              ?.map(part => part.text || "")
              .join("")
              .trim();

          if (result) {

            return res.status(200).json({
              success: true,
              model: model,
              result: result
            });

          }

          lastError =
            `${model}: Gemini returned an empty response.`;

          continue;
        }

        /*
          Temporary Gemini errors:
          429 = rate limit
          500 = server error
          502 = bad gateway
          503 = overloaded/unavailable
          504 = timeout
        */

        if (
          response.status === 429 ||
          response.status === 500 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504
        ) {

          lastError =
            `${model}: ${
              data?.error?.message ||
              `HTTP ${response.status}`
            }`;

          console.log(
            `Gemini model ${model} unavailable. Trying next model.`
          );

          continue;
        }

        /*
          Permanent/API configuration error.
        */

        return res.status(response.status).json({
          error:
            `Gemini API error (${model}): ` +
            (
              data?.error?.message ||
              `HTTP ${response.status}`
            )
        });

      } catch (error) {

        lastError =
          `${model}: ${error?.message || "Request failed."}`;

        console.log(
          `Gemini model ${model} request failed. Trying next model.`
        );

        continue;
      }
    }

    /*
      Every fallback model failed.
    */

    return res.status(503).json({
      error:
        "⚠️ Gemini is temporarily unavailable across the available Flash models. " +
        "Please try again shortly."
    });

  } catch (error) {

    console.error(
      "Fix API error:",
      error
    );

    return res.status(500).json({
      error:
        "Server error: " +
        (error?.message || "Unknown error.")
    });
  }
}
