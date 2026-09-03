export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { code, language } = req.body || {};

    // Validate code
    if (!code || typeof code !== "string") {
      return res.status(400).json({
        error: "Please provide valid code."
      });
    }

    // Prevent extremely large requests
    if (code.length > 12000) {
      return res.status(400).json({
        error: "Code is too long. Please keep it under 12,000 characters."
      });
    }

    // Supported languages
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

    // Get Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API key is not configured."
      });
    }

    // Prompt
    const prompt = `
You are an expert ${language} software developer and debugging assistant.

Analyze the following ${language} code.

Your job is to:

1. Identify genuine bugs.
2. Explain what is wrong.
3. Correct the code.
4. Preserve the original purpose and functionality.
5. Improve obvious reliability and code-quality problems.
6. Do not make unnecessary changes.

Return the response using exactly this structure:

SUMMARY:
Briefly explain the problem and the fix.

FIXED CODE:
Provide the complete corrected code inside a markdown code block.

CHANGES:
1. Explain the first important change.
2. Explain the second important change.
3. Explain any other important change.

Make sure the corrected code is complete and directly usable.

CODE TO FIX:

\`\`\`${language}
${code}
\`\`\`
`;

    // Gemini request
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

    // Read Gemini response
    const data = await response.json();

    // IMPORTANT:
    // Return the actual Gemini error so we can diagnose it.
    if (!response.ok) {

      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error:
          "Gemini API error: " +
          (
            data?.error?.message ||
            "Unknown Gemini API error."
          )
      });
    }

    // Extract generated response
    const result =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    // Empty response
    if (!result) {

      console.error(
        "Gemini returned no usable content:",
        data
      );

      return res.status(502).json({
        error:
          "Gemini API returned an empty response."
      });
    }

    // Successful response
    return res.status(200).json({
      success: true,
      result: result
    });

  } catch (error) {

    console.error(
      "Fix API error:",
      error
    );

    return res.status(500).json({
      error:
        "Fix API error: " +
        (error?.message || "Unknown server error.")
    });
  }
}
