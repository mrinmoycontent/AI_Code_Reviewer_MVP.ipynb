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
        error: "GEMINI_API_KEY is not configured."
      });
    }

    const prompt = `
You are an expert software engineer and code reviewer.

Review the following ${language} code.

Identify genuine bugs and important problems only.
Do not invent problems.
Preserve the original purpose of the code.

Return the result using this format:

SUMMARY:
Briefly explain whether there are genuine issues.

ISSUES:
List the genuine bugs or important problems.
If there are none, say:
No genuine bugs found.

SUGGESTIONS:
List useful improvements only when appropriate.

CODE:
${code}
`;

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

    if (!response.ok) {
      console.error("Gemini Review error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          data?.error ||
          "Gemini review request failed."
      });
    }

    const result =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!result) {
      return res.status(500).json({
        error: "Gemini returned an empty review."
      });
    }

    return res.status(200).json({
      success: true,
      result
    });

  } catch (error) {
    console.error("Review API error:", error);

    return res.status(500).json({
      error:
        "AI review service error: " +
        (error?.message || "Unknown error")
    });
  }
}
