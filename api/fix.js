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
        error: "Code is too long. Please keep it under 12,000 characters."
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

Find genuine bugs and fix them.
Preserve the original purpose of the program.
Do not unnecessarily rewrite working code.

Return exactly:

SUMMARY:
Explain the problem and the solution.

FIXED CODE:
Provide the COMPLETE corrected code inside a markdown code block.

CHANGES:
List the important changes.

CODE:
\`\`\`${language}
${code}
\`\`\`
`;

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

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error:
          "Gemini API error: " +
          (
            data?.error?.message ||
            `HTTP ${response.status}`
          )
      });
    }

    const result =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!result) {
      return res.status(502).json({
        error: "Gemini returned an empty response. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      result: result
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
