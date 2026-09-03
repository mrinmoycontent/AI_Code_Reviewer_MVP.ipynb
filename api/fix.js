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

Review the following ${language} code and fix genuine bugs.

Preserve the original purpose of the program.
Do not unnecessarily rewrite working code.
Do not invent bugs.

Return exactly:

SUMMARY:
Explain the genuine bug and the fix.

FIXED CODE:
Provide the complete corrected code in a markdown code block.

CHANGES:
List the important changes.

Original code:

${code}
`;

    const models = [
      "gemini-3.7-flash",
      "gemini-3.6-flash"
    ];

    let lastError = "";

    for (const model of models) {

      for (let attempt = 1; attempt <= 2; attempt++) {

        try {

          const controller = new AbortController();

          const timeout = setTimeout(() => {
            controller.abort();
          }, 30000);

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: "POST",

              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
              },

              signal: controller.signal,

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

          clearTimeout(timeout);

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

            lastError =
              "Gemini returned an empty response.";

          } else {

            lastError =
              data?.error?.message ||
              `HTTP ${response.status}`;

            console.error(
              `Gemini ${model}, attempt ${attempt}:`,
              lastError
            );

            const temporaryError =
              response.status === 429 ||
              response.status === 500 ||
              response.status === 502 ||
              response.status === 503 ||
              response.status === 504;

            if (!temporaryError) {

              return res.status(response.status).json({
                error:
                  "Gemini API error: " + lastError
              });

            }

          }

        } catch (error) {

          lastError =
            error?.name === "AbortError"
              ? "Gemini request timed out."
              : error?.message ||
                "Network request failed.";

          console.error(
            `Gemini ${model}, attempt ${attempt}:`,
            lastError
          );

        }

        if (attempt < 2) {

          await new Promise(resolve => {
            setTimeout(resolve, 1500);
          });

        }

      }

    }

    return res.status(503).json({
      error:
        "AI service is temporarily busy. Please try again shortly."
    });

  } catch (error) {

    console.error(
      "Fix API error:",
      error
    );

    return res.status(500).json({
      error:
        "Server error while generating the code fix."
    });

  }

}
