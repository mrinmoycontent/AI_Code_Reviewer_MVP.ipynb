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

    const token = process.env.HF_TOKEN;

    if (!token) {
      return res.status(500).json({
        error: "HF_TOKEN is missing in Vercel."
      });
    }

    const prompt = `
You are an expert ${language} developer and code reviewer.

Review the following ${language} code.

Your job:
1. Identify genuine bugs or errors.
2. Explain why they are problems.
3. Provide the complete corrected code.
4. Do not invent problems.
5. Preserve the original purpose of the code.
6. Do not add unnecessary features or changes.

Return exactly this format:

SUMMARY:
Explain the genuine problem(s) and how they were fixed.

FIXED CODE:
Provide the complete corrected code inside a markdown code block.

CHANGES:
List only the important changes made.

CODE TO REVIEW:
${code}
`;

    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 4096,
          temperature: 0.1
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Hugging Face API error:", data);

      return res.status(response.status).json({
        error:
          data?.error ||
          data?.message ||
          `Hugging Face API error: HTTP ${response.status}`
      });
    }

    const result =
      data?.choices?.[0]?.message?.content?.trim();

    if (!result) {
      console.error("Empty Hugging Face response:", data);

      return res.status(500).json({
        error: "Hugging Face returned an empty response."
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
        "AI fix service error: " +
        (error?.message || "Unknown error")
    });
  }
}
