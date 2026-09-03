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
You are an expert software developer specializing in ${language}.

Review the user's ${language} code below.

Your tasks:
1. Find genuine bugs.
2. Fix the bugs.
3. Preserve the original purpose of the program.
4. Improve reliability where appropriate.
5. Do not unnecessarily rewrite working code.

Return exactly this format:

SUMMARY:
Briefly explain the problem and solution.

FIXED CODE:
Return the COMPLETE corrected code inside one markdown code block.

CHANGES:
List the important changes made.

USER CODE:

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
            maxOutputTokens: 4096
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          `Gemini API returned HTTP ${response.status}.`
      });
    }

    const result = data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!result) {
      return res.status(500).json({
        error: "Gemini returned an empty response."
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
