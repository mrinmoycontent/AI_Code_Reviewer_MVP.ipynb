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

Review and fix the following ${language} code.

Preserve the original purpose of the program.
Identify genuine bugs and correct them.
Do not add unnecessary complexity.

Return exactly:

SUMMARY:
Explain the problem and fix.

FIXED CODE:
Provide the complete corrected code in a markdown code block.

CHANGES:
List the important changes.

Code:
\`\`\`${language}
${code}
\`\`\`
`;

    const models = [
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash"
    ];

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
        }

        console.error(
          `${model} failed:`,
          data?.error?.message || response.status
        );

      } catch (error) {
        console.error(`${model} request failed:`, error);
      }
    }

    return res.status(503).json({
      error:
        "⚠️ AI Fix is temporarily unavailable. Please try again shortly."
    });

  } catch (error) {
    console.error("Fix API error:", error);

    return res.status(500).json({
      error:
        "Server error: " +
        (error?.message || "Unknown error")
    });
  }
}
