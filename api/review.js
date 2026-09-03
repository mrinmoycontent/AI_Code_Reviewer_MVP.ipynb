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
        error: "AI service is not configured."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
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
                  text:
                    `You are an expert software code reviewer.

Review the following ${language} code.

Identify:
1. Bugs
2. Security issues
3. Code quality problems
4. Performance issues
5. Recommended improvements

Give a clear, structured review and an overall code quality score out of 100.

Code:

\`\`\`${language}
${code}
\`\`\``
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      if (
        response.status === 429 ||
        response.status === 503 ||
        response.status === 500
      ) {
        return res.status(503).json({
          error:
            "⚠️ AI service is temporarily busy. Please try again in a moment."
        });
      }

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Unable to get an AI review."
      });
    }

    const result =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!result) {
      return res.status(502).json({
        error:
          "⚠️ AI did not return a review. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      result: result
    });

  } catch (error) {

    console.error("Review API error:", error);

    return res.status(500).json({
      error:
        "⚠️ Unable to connect to the AI service. Please try again."
    });
  }
}
