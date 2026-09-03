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
        error: "GEMINI_API_KEY is missing in Vercel."
      });
    }

    const prompt = `
You are an expert ${language} developer.

Review and fix the following ${language} code.

Preserve the original purpose of the program.

Identify genuine bugs and correct them.

Return exactly:

SUMMARY:
Explain the problem and how it was fixed.

FIXED CODE:
Provide the complete corrected code inside a markdown code block.

CHANGES:
List the important changes.

CODE:

\`\`\`${language}
${code}
\`\`\`
`;

    /*
      Try current stable Flash models in order.
      If one is temporarily overloaded, try the next one.
    */

    const models = [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash"
    ];

    let errors = [];

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
          SUCCESS
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

          errors.push(
            `${model}: Empty response`
          );

          continue;
        }

        /*
          TEMPORARY ERRORS
          Try the next model.
        */

        if (
          response.status === 429 ||
          response.status === 500 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504
        ) {

          errors.push(
            `${model}: ${
              data?.error?.message ||
              `HTTP ${response.status}`
            }`
          );

          continue;
        }

        /*
          PERMANENT ERROR
          Stop immediately.
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

        errors.push(
          `${model}: ${error?.message || "Request failed"}`
        );

      }
    }

    /*
      All models failed.
    */

    console.error(
      "All Gemini models failed:",
      errors
    );

    return res.status(503).json({
      error:
        "Gemini is temporarily unavailable. " +
        "All available Flash models were unavailable."
    });

  } catch (error) {

    console.error(
      "Fix API error:",
      error
    );

    return res.status(500).json({
      error:
        "Server error: " +
        (error?.message || "Unknown error")
    });
  }
}
